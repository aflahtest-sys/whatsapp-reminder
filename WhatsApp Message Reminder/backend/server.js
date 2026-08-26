'use strict';

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodeSchedule = require('node-schedule');

const config = require('./lib/config');
const supabase = require('./lib/db');
const rateLimit = require('./lib/ratelimit');
const whatsapp = require('./lib/whatsapp');
const scheduler = require('./lib/scheduler');
const recurrence = require('./lib/recurrence');
const { parsePhone, formatPhone } = require('./lib/phone');
const {
  PLACEHOLDERS,
  unknownPlaceholders,
  PLACEHOLDER_KEYS,
  renderForCustomer,
} = require('./lib/template');

const app = express();
app.set('trust proxy', 1); // Railway/Vercel sit behind a proxy; needed for real client IPs

/**
 * A real bcrypt hash of a random value, computed once at boot.
 *
 * It is compared against when an email is not found so that a missing account
 * and a wrong password take the same amount of time. Hand-writing a fake hash
 * does not work: bcryptjs checks the length first and returns instantly for
 * anything that is not exactly 60 characters, which leaves the user-enumeration
 * timing difference wide open.
 */
const DUMMY_HASH = bcrypt.hashSync(require('crypto').randomBytes(24).toString('hex'), 12);

/* ---------------------------- middleware ---------------------------- */

app.use(
  cors({
    origin: config.allowedOrigins.length ? config.allowedOrigins : '*',
    credentials: false,
  })
);

app.use(express.json({ limit: '1mb' }));

// Malformed JSON is the caller's mistake, not a server fault -- say 400, not 500.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return jsonError(res, 400, 'Request body is not valid JSON');
  }
  if (err && err.type === 'entity.too.large') {
    return jsonError(res, 413, 'Request body is too large');
  }
  return next(err);
});

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

// Treat "/customers/" the same as "/customers".
app.use((req, res, next) => {
  if (req.path.length > 1 && req.path.endsWith('/')) {
    req.url = req.url.replace(/\/+$/, '') || '/';
  }
  next();
});

/* ------------------------------ helpers ------------------------------ */

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return jsonError(res, 401, 'Authentication required');
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return jsonError(res, 401, 'Invalid or expired token');
  }
}

/** Wrap an async handler so a rejected promise reaches the error middleware. */
function handler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Confirm a row belongs to the calling user before it is referenced.
 * The previous version accepted any customer_id and template_id on
 * POST /schedules, so one account could schedule messages against another
 * account's customer records.
 */
async function ownsRow(table, id, userId, columns = 'id') {
  if (!id) return null;
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

function publicSession(row, live) {
  return {
    id: row.id,
    account_name: row.account_name,
    qr_code: row.qr_code,
    is_authenticated: live ? live.ready : row.is_authenticated,
    state: live ? live.state : row.is_authenticated ? 'ready' : 'not_started',
    last_error: live ? live.lastError : null,
    last_ready_at: row.last_ready_at,
    created_at: row.created_at,
  };
}

// Two buckets, because one is not enough. Per-email stops someone hammering a
// single account; per-IP stops password spraying -- one attacker trying three
// common passwords against ten thousand different addresses would never trip an
// email-keyed limiter, since each address gets its own fresh allowance.
const perEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  // Must normalise exactly the way the lookup below does. If the key kept
  // surrounding whitespace while the query trimmed it, " a@b.com" and "a@b.com"
  // would hit the same account through two separate buckets -- ten free guesses
  // per variation, which is no limit at all.
  keyFn: (req) => `email:${String((req.body && req.body.email) || '').toLowerCase().trim()}`,
  message: 'Too many sign-in attempts for this account. Please wait 15 minutes and try again.',
});

const perIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyFn: (req) => `ip:${req.ip}`,
  message: 'Too many sign-in attempts from this device. Please wait 15 minutes and try again.',
});

const authLimiter = [perIpLimiter, perEmailLimiter];

const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyFn: (req) => (req.user ? req.user.id : req.ip),
  message: 'Too many test messages this hour.',
});

/* ------------------------------- auth -------------------------------- */

app.post(
  '/auth/register',
  authLimiter,
  handler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return jsonError(res, 400, 'A valid email is required');
    }
    if (!password || password.length < 8) {
      return jsonError(res, 400, 'Password must be at least 8 characters');
    }

    const password_hash = await bcrypt.hash(password, 12);
    const { data, error } = await supabase
      .from('users')
      .insert({ email: String(email).toLowerCase().trim(), password_hash })
      .select('id, email, created_at')
      .single();

    if (error) {
      if (error.code === '23505') return jsonError(res, 409, 'Email already registered');
      console.error('[auth] register failed:', error.message);
      return jsonError(res, 500, 'Failed to create account');
    }

    res.status(201).json({ token: signToken(data), user: data });
  })
);

app.post(
  '/auth/login',
  authLimiter,
  handler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return jsonError(res, 400, 'Email and password are required');

    const { data, error } = await supabase
      .from('users')
      .select('id, email, password_hash, created_at')
      .eq('email', String(email).toLowerCase().trim())
      .maybeSingle();

    // Always run a real comparison so a missing account and a wrong password
    // take the same amount of time and cannot be told apart.
    const hash = (data && data.password_hash) || DUMMY_HASH;
    const valid = await bcrypt.compare(password, hash);

    if (error || !data || !valid) return jsonError(res, 401, 'Invalid email or password');

    const { password_hash, ...user } = data;
    res.json({ token: signToken(user), user });
  })
);

app.get(
  '/auth/me',
  requireAuth,
  handler(async (req, res) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, created_at')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error || !data) return jsonError(res, 401, 'User not found');
    res.json({ user: data });
  })
);

/* ----------------------------- whatsapp ------------------------------ */

app.post(
  '/whatsapp/link',
  requireAuth,
  handler(async (req, res) => {
    const userId = req.user.id;
    const { account_name, restart } = req.body || {};

    const { data: existing } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    let session = existing && existing.length ? existing[0] : null;

    if (!session) {
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .insert({ user_id: userId, account_name: (account_name || 'WhatsApp').trim() })
        .select()
        .single();
      if (error) {
        console.error('[wa] failed to create session row:', error.message);
        return jsonError(res, 500, 'Failed to create session');
      }
      session = data;
    } else if (account_name && account_name.trim() && account_name.trim() !== session.account_name) {
      await supabase
        .from('whatsapp_sessions')
        .update({ account_name: account_name.trim() })
        .eq('id', session.id);
      session.account_name = account_name.trim();
    }

    // "Restart" exists because a client can get stuck before it ever emits a QR
    // code, and the old code returned early whenever an entry was in the map --
    // leaving no way to recover except a redeploy.
    if (restart) {
      await supabase
        .from('whatsapp_sessions')
        .update({ qr_code: null, is_authenticated: false })
        .eq('id', session.id);
      await whatsapp.restartClient(userId, session);
    } else {
      await whatsapp.startClient(userId, session);
    }

    res.status(201).json({ session: publicSession(session, whatsapp.statusFor(userId)) });
  })
);

app.get(
  '/whatsapp/status',
  requireAuth,
  handler(async (req, res) => {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('id, account_name, qr_code, is_authenticated, last_ready_at, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return jsonError(res, 500, 'Failed to load sessions');

    const live = whatsapp.statusFor(req.user.id);
    res.json({ sessions: (data || []).map((row) => publicSession(row, live)) });
  })
);

app.post(
  '/whatsapp/disconnect',
  requireAuth,
  handler(async (req, res) => {
    const { session_id } = req.body || {};
    if (!session_id) return jsonError(res, 400, 'session_id is required');

    const owned = await ownsRow('whatsapp_sessions', session_id, req.user.id);
    if (!owned) return jsonError(res, 404, 'Session not found');

    await whatsapp.stopClient(req.user.id, { wipeSession: true });
    await supabase
      .from('whatsapp_sessions')
      .update({ is_authenticated: false, qr_code: null, session_data: null })
      .eq('id', session_id);

    res.json({ ok: true });
  })
);

/**
 * Send a single message right now, without creating a schedule.
 * The quickest way to confirm the link actually works before trusting it with
 * a client list.
 */
app.post(
  '/whatsapp/test',
  requireAuth,
  sendLimiter,
  handler(async (req, res) => {
    const { phone, body } = req.body || {};
    const parsed = parsePhone(phone, config.defaultCountryCode);
    if (!parsed.ok) return jsonError(res, 400, parsed.error);

    const text = String(body || '').trim() || 'Test message from WhatsApp Reminders.';
    const outcome = await whatsapp.sendMessage(req.user.id, parsed.phone, text);

    await supabase.from('delivery_logs').insert({
      user_id: req.user.id,
      message_body: text,
      sent_at: new Date().toISOString(),
      status: outcome.ok ? 'success' : 'failed',
      error: outcome.ok ? null : outcome.error,
    });

    if (!outcome.ok) return jsonError(res, 400, outcome.error);
    res.json({ ok: true, to: formatPhone(parsed.phone) });
  })
);

/* ----------------------------- customers ----------------------------- */

/**
 * Normalise group tags.
 *
 * Commas and braces are stripped rather than escaped: PostgREST serialises an
 * array filter as `cs.{tag}`, so a tag containing a comma would be read back as
 * two separate tags and quietly match the wrong customers.
 */
function cleanTags(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  for (const tag of input) {
    const value = String(tag || '')
      .toLowerCase()
      .replace(/[^a-z0-9 _-]+/g, '') // no commas, braces, quotes or backslashes
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
    if (value) seen.add(value);
  }
  return [...seen].slice(0, 20);
}

app.get(
  '/customers',
  requireAuth,
  handler(async (req, res) => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return jsonError(res, 500, 'Failed to load customers');
    res.json({ customers: data || [] });
  })
);

app.get(
  '/customers/tags',
  requireAuth,
  handler(async (req, res) => {
    const { data, error } = await supabase
      .from('customers')
      .select('tags')
      .eq('user_id', req.user.id);
    if (error) return jsonError(res, 500, 'Failed to load tags');

    const counts = new Map();
    for (const row of data || []) {
      for (const tag of row.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    const tags = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ tags });
  })
);

app.post(
  '/customers',
  requireAuth,
  handler(async (req, res) => {
    const { name, phone, tags } = req.body || {};
    if (!name || !String(name).trim()) return jsonError(res, 400, 'Name is required');

    const parsed = parsePhone(phone, config.defaultCountryCode);
    if (!parsed.ok) return jsonError(res, 400, parsed.error);

    const { data, error } = await supabase
      .from('customers')
      .insert({
        user_id: req.user.id,
        name: String(name).trim(),
        phone: parsed.phone,
        tags: cleanTags(tags),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return jsonError(res, 409, 'A customer with that phone number already exists');
      }
      console.error('[customers] insert failed:', error.message);
      return jsonError(res, 500, 'Failed to create customer');
    }

    res.status(201).json({ customer: data, assumedCountry: parsed.assumedCountry });
  })
);

app.put(
  '/customers/:id',
  requireAuth,
  handler(async (req, res) => {
    const { name, phone, tags } = req.body || {};
    if (!name || !String(name).trim()) return jsonError(res, 400, 'Name is required');

    const parsed = parsePhone(phone, config.defaultCountryCode);
    if (!parsed.ok) return jsonError(res, 400, parsed.error);

    const { data, error } = await supabase
      .from('customers')
      .update({ name: String(name).trim(), phone: parsed.phone, tags: cleanTags(tags) })
      .eq('user_id', req.user.id)
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error && error.code === '23505') {
      return jsonError(res, 409, 'Another customer already uses that phone number');
    }
    if (error || !data) return jsonError(res, 404, 'Customer not found');
    res.json({ customer: data, assumedCountry: parsed.assumedCountry });
  })
);

app.delete(
  '/customers/:id',
  requireAuth,
  handler(async (req, res) => {
    const owned = await ownsRow('customers', req.params.id, req.user.id);
    if (!owned) return jsonError(res, 404, 'Customer not found');

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('user_id', req.user.id)
      .eq('id', req.params.id);
    if (error) return jsonError(res, 500, 'Failed to delete customer');
    res.json({ ok: true });
  })
);

/* -------------------------- message templates ------------------------ */

app.get('/messages/placeholders', requireAuth, (req, res) => {
  res.json({
    placeholders: PLACEHOLDER_KEYS.map((key) => ({ key, description: PLACEHOLDERS[key] })),
  });
});

app.get(
  '/messages',
  requireAuth,
  handler(async (req, res) => {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return jsonError(res, 500, 'Failed to load templates');
    res.json({ templates: data || [] });
  })
);

function validateTemplate(name, body) {
  if (!name || !String(name).trim()) return 'Template name is required';
  if (!body || !String(body).trim()) return 'Template body is required';
  if (String(body).length > 4000) return 'Template body is too long (maximum 4000 characters)';

  const unknown = unknownPlaceholders(body);
  if (unknown.length) {
    return `Unknown placeholder${unknown.length > 1 ? 's' : ''} ${unknown
      .map((u) => `{${u}}`)
      .join(', ')}. Available: ${PLACEHOLDER_KEYS.map((k) => `{${k}}`).join(', ')}`;
  }
  return null;
}

app.post(
  '/messages',
  requireAuth,
  handler(async (req, res) => {
    const { name, body } = req.body || {};
    const problem = validateTemplate(name, body);
    if (problem) return jsonError(res, 400, problem);

    const { data, error } = await supabase
      .from('message_templates')
      .insert({ user_id: req.user.id, name: String(name).trim(), body: String(body).trim() })
      .select()
      .single();
    if (error) return jsonError(res, 500, 'Failed to create template');
    res.status(201).json({ template: data });
  })
);

app.put(
  '/messages/:id',
  requireAuth,
  handler(async (req, res) => {
    const { name, body } = req.body || {};
    const problem = validateTemplate(name, body);
    if (problem) return jsonError(res, 400, problem);

    const { data, error } = await supabase
      .from('message_templates')
      .update({ name: String(name).trim(), body: String(body).trim() })
      .eq('user_id', req.user.id)
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (error || !data) return jsonError(res, 404, 'Template not found');
    res.json({ template: data });
  })
);

app.delete(
  '/messages/:id',
  requireAuth,
  handler(async (req, res) => {
    const owned = await ownsRow('message_templates', req.params.id, req.user.id);
    if (!owned) return jsonError(res, 404, 'Template not found');

    // Tell the caller what else disappears -- schedules cascade on delete.
    // A failed count is not worth blocking the delete over; report 0 instead.
    const { count } = await supabase
      .from('scheduled_sends')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('template_id', req.params.id)
      .eq('status', 'active');

    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('user_id', req.user.id)
      .eq('id', req.params.id);
    if (error) return jsonError(res, 500, 'Failed to delete template');

    res.json({ ok: true, cancelled_schedules: count || 0 });
  })
);

/* ------------------------------ schedules ---------------------------- */

app.get(
  '/schedules',
  requireAuth,
  handler(async (req, res) => {
    const { data, error } = await supabase
      .from('scheduled_sends')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return jsonError(res, 500, 'Failed to load schedules');
    res.json({ schedules: data || [] });
  })
);

app.post(
  '/schedules',
  requireAuth,
  handler(async (req, res) => {
    const userId = req.user.id;
    const {
      customer_id,
      template_id,
      send_type,
      schedule_time,
      target_type = 'customer',
      target_tag,
      weekly_day,
    } = req.body || {};

    if (!['immediate', 'once', 'daily', 'weekly'].includes(send_type)) {
      return jsonError(res, 400, 'send_type must be one of immediate, once, daily, weekly');
    }
    if (!['customer', 'tag', 'all'].includes(target_type)) {
      return jsonError(res, 400, 'target_type must be one of customer, tag, all');
    }

    const template = await ownsRow('message_templates', template_id, userId);
    if (!template) return jsonError(res, 404, 'Template not found');

    let resolvedCustomerId = null;
    let resolvedTag = null;

    if (target_type === 'customer') {
      const customer = await ownsRow('customers', customer_id, userId);
      if (!customer) return jsonError(res, 404, 'Customer not found');
      resolvedCustomerId = customer.id;
    } else if (target_type === 'tag') {
      resolvedTag = String(target_tag || '').trim().toLowerCase();
      if (!resolvedTag) return jsonError(res, 400, 'A group tag is required');

      const { count, error: countError } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .contains('tags', [resolvedTag]);
      // Distinguish "the group is empty" from "the database hiccuped" -- telling
      // the user their tag matches nobody when it actually does is worse than
      // admitting something went wrong.
      if (countError) return jsonError(res, 503, 'Could not check that group. Please try again.');
      if (!count) return jsonError(res, 400, `No customers are tagged "${resolvedTag}"`);
    } else {
      const { count, error: countError } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (countError) return jsonError(res, 503, 'Could not load your customers. Please try again.');
      if (!count) return jsonError(res, 400, 'You have no customers to send to');
    }

    let day = null;
    if (send_type === 'weekly') {
      day = Number(weekly_day);
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        return jsonError(res, 400, 'weekly_day must be a number from 0 (Sunday) to 6 (Saturday)');
      }
    }

    let when;
    if (send_type === 'immediate') {
      when = new Date();
    } else {
      if (!schedule_time) return jsonError(res, 400, 'A date and time is required');
      when = new Date(schedule_time);
      if (Number.isNaN(when.getTime())) return jsonError(res, 400, 'Invalid date and time');

      if (send_type === 'once' && when.getTime() <= Date.now()) {
        return jsonError(res, 400, 'Pick a time in the future');
      }
      if (recurrence.isRecurring(send_type) && when.getTime() <= Date.now()) {
        // Recurring schedules submitted with a past anchor roll forward instead
        // of firing a burst of catch-up messages the moment they are created.
        when = recurrence.nextOccurrence(send_type, when) || when;
      }
    }

    const { data, error } = await supabase
      .from('scheduled_sends')
      .insert({
        user_id: userId,
        customer_id: resolvedCustomerId,
        template_id: template.id,
        send_type,
        target_type,
        target_tag: resolvedTag,
        weekly_day: day,
        schedule_time: when.toISOString(),
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('[schedules] insert failed:', error.message);
      return jsonError(res, 400, 'Failed to create schedule');
    }

    // Nudge the scheduler so "send now" feels immediate instead of waiting for
    // the next minute tick. Row locking makes a double-send impossible.
    if (send_type === 'immediate') {
      scheduler.processDue().catch((err) => console.error('[schedules] kick failed:', err.message));
    }

    res.status(201).json({ schedule: data });
  })
);

app.post(
  '/schedules/:id/cancel',
  requireAuth,
  handler(async (req, res) => {
    const { data, error } = await supabase
      .from('scheduled_sends')
      .update({ status: 'cancelled', locked_at: null })
      .eq('user_id', req.user.id)
      .eq('id', req.params.id)
      .eq('status', 'active')
      .select()
      .maybeSingle();
    if (error || !data) return jsonError(res, 404, 'Schedule not found or already finished');
    res.json({ schedule: data });
  })
);

/** Bring a failed or cancelled schedule back to life. */
app.post(
  '/schedules/:id/resume',
  requireAuth,
  handler(async (req, res) => {
    const existing = await ownsRow(
      'scheduled_sends',
      req.params.id,
      req.user.id,
      'id, send_type, schedule_time, status'
    );
    if (!existing) return jsonError(res, 404, 'Schedule not found');
    if (existing.status === 'active') return jsonError(res, 400, 'That schedule is already active');
    if (existing.send_type === 'immediate' || existing.send_type === 'once') {
      return jsonError(res, 400, 'One-off sends cannot be resumed. Create a new one instead.');
    }

    const next = recurrence.nextOccurrence(existing.send_type, existing.schedule_time);
    const { data, error } = await supabase
      .from('scheduled_sends')
      .update({
        status: 'active',
        attempts: 0,
        locked_at: null,
        last_error: null,
        schedule_time: next ? next.toISOString() : existing.schedule_time,
      })
      .eq('user_id', req.user.id)
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error || !data) return jsonError(res, 500, 'Failed to resume schedule');
    res.json({ schedule: data });
  })
);

app.delete(
  '/schedules/:id',
  requireAuth,
  handler(async (req, res) => {
    const owned = await ownsRow('scheduled_sends', req.params.id, req.user.id);
    if (!owned) return jsonError(res, 404, 'Schedule not found');

    const { error } = await supabase
      .from('scheduled_sends')
      .delete()
      .eq('user_id', req.user.id)
      .eq('id', req.params.id);
    if (error) return jsonError(res, 500, 'Failed to delete schedule');
    res.json({ ok: true });
  })
);

/** Preview a template exactly as one customer would receive it. */
app.post(
  '/schedules/preview',
  requireAuth,
  handler(async (req, res) => {
    const { template_id, customer_id } = req.body || {};
    const template = await ownsRow('message_templates', template_id, req.user.id, 'id, body');
    if (!template) return jsonError(res, 404, 'Template not found');

    let customer = null;
    if (customer_id) {
      customer = await ownsRow('customers', customer_id, req.user.id, 'id, name, phone');
    }
    if (!customer) {
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('user_id', req.user.id)
        .limit(1)
        .maybeSingle();
      customer = data || { name: 'Sample Customer', phone: `${config.defaultCountryCode}91234567` };
    }

    res.json({ preview: renderForCustomer(template.body, customer, { timezone: config.timezone }) });
  })
);

/* -------------------------------- logs ------------------------------- */

app.get(
  '/logs',
  requireAuth,
  handler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    let query = supabase
      .from('delivery_logs')
      .select('id, customer_id, schedule_id, message_body, error, sent_at, status, customers(name)', {
        count: 'exact',
      })
      .eq('user_id', req.user.id);

    if (req.query.status === 'success' || req.query.status === 'failed') {
      query = query.eq('status', req.query.status);
    }

    const { data, error, count } = await query
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return jsonError(res, 500, 'Failed to load logs');
    res.json({ logs: data || [], total: count || 0, limit, offset });
  })
);

/* -------------------------------- misc ------------------------------- */

app.get('/health', (req, res) =>
  res.json({
    ok: true,
    whatsapp_clients: whatsapp.clients.size,
    scheduler: scheduler.status(),
    timezone: config.timezone,
  })
);

app.get('/', (req, res) =>
  res.json({ ok: true, name: 'whatsapp-reminder-backend', health: '/health' })
);

app.use((req, res) => jsonError(res, 404, 'Route not found'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  jsonError(res, 500, 'Internal server error');
});

/* -------------------------------- boot ------------------------------- */

const server = app.listen(config.port, async () => {
  console.log(`Server listening on port ${config.port}`);
  console.log(`WhatsApp sessions stored in ${config.waSessionPath}`);
  console.log(`Timezone ${config.timezone}, default country code +${config.defaultCountryCode}`);

  // Register the minute timer FIRST and unconditionally. If startup recovery
  // throws, this callback would reject into the unhandledRejection handler and
  // the timer would never be created -- the process would keep serving HTTP,
  // /health would keep saying "ok", and not one reminder would ever be sent.
  nodeSchedule.scheduleJob('* * * * *', () => {
    scheduler.processDue().catch((err) => console.error('[scheduler] tick failed:', err.message));
  });

  try {
    // Order matters. Reconnect WhatsApp BEFORE the scheduler runs, otherwise the
    // first tick sees no clients and treats every due reminder as undeliverable.
    await scheduler.recoverStaleLocks();
    await whatsapp.rehydrateSessions();
  } catch (err) {
    console.error('[boot] startup recovery failed, continuing anyway:', err.message);
  }

  // Give the browser sessions a moment to reach "ready" before the first sweep.
  setTimeout(() => {
    scheduler
      .processDue()
      .catch((err) => console.error('[scheduler] first run failed:', err.message));
  }, 30_000);
});

async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);
  server.close();
  await nodeSchedule.gracefulShutdown().catch(() => {});
  await whatsapp.shutdownAll();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

module.exports = app;
