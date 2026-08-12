require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const schedule = require('node-schedule');

const { SUPABASE_URL, SUPABASE_KEY, JWT_SECRET, PORT, CLIENT_ORIGIN } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY || !JWT_SECRET) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_KEY, JWT_SECRET');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));

/* ----------------------------- helpers ----------------------------- */

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

/* ------------------------- WhatsApp sessions ------------------------ */

const clients = new Map(); // userId -> { client, sessionId }

async function updateSession(userId, sessionId, patch) {
  const { error } = await supabase
    .from('whatsapp_sessions')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', sessionId);
  if (error) console.error('[wa] failed to update session:', error.message);
}

function buildClient(userId, sessionId, sessionData) {
  const client = new Client({
    session: sessionData ? JSON.parse(sessionData) : undefined,
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

  client.on('qr', (qr) => {
    QRCode.toDataURL(qr)
      .then((url) => updateSession(userId, sessionId, { qr_code: url, is_authenticated: false }))
      .catch((err) => console.error('[wa] QR encode failed:', err.message));
  });

  client.on('authenticated', (session) => {
    updateSession(userId, sessionId, { session_data: JSON.stringify(session) });
  });

  client.on('ready', () => {
    updateSession(userId, sessionId, { is_authenticated: true, qr_code: null });
    console.log(`[wa] ready for user ${userId}`);
  });

  client.on('auth_failure', (msg) => {
    updateSession(userId, sessionId, { is_authenticated: false });
    console.error('[wa] auth_failure for user', userId, msg);
  });

  client.on('disconnected', (reason) => {
    updateSession(userId, sessionId, { is_authenticated: false });
    clients.delete(userId);
    console.warn('[wa] disconnected for user', userId, reason);
  });

  return client;
}

async function startClient(userId, sessionRow) {
  if (clients.has(userId)) return clients.get(userId);
  const client = buildClient(userId, sessionRow.id, sessionRow.session_data);
  const entry = { client, sessionId: sessionRow.id };
  clients.set(userId, entry);
  client.initialize().catch((err) => console.error('[wa] initialize failed:', err.message));
  return entry;
}

/* ------------------------------ auth -------------------------------- */

app.post('/auth/register', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return jsonError(res, 400, 'A valid email is required');
    }
    if (!password || password.length < 6) {
      return jsonError(res, 400, 'Password must be at least 6 characters');
    }
    const password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert({ id: crypto.randomUUID(), email: email.toLowerCase(), password_hash })
      .select('id, email, created_at')
      .single();
    if (error) {
      if (error.code === '23505') return jsonError(res, 409, 'Email already registered');
      return jsonError(res, 500, 'Failed to create user');
    }
    res.status(201).json({ token: signToken(data), user: data });
  } catch (err) {
    next(err);
  }
});

app.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return jsonError(res, 400, 'Email and password are required');
    const { data, error } = await supabase
      .from('users')
      .select('id, email, password_hash, created_at')
      .eq('email', email.toLowerCase())
      .single();
    if (error || !data) return jsonError(res, 401, 'Invalid email or password');
    const valid = await bcrypt.compare(password, data.password_hash);
    if (!valid) return jsonError(res, 401, 'Invalid email or password');
    const { password_hash, ...user } = data;
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

app.get('/auth/me', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, created_at')
      .eq('id', req.user.id)
      .single();
    if (error || !data) return jsonError(res, 401, 'User not found');
    res.json({ user: data });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------- whatsapp ------------------------------ */

app.post('/whatsapp/link', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { account_name } = req.body || {};

    const { data: existing } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existing && existing.length) {
      const session = existing[0];
      const entry = clients.get(userId);
      if (entry && entry.client.info && entry.client.info.wid) {
        return res.json({ session: { ...session, is_authenticated: true } });
      }
      if (session.is_authenticated) {
        await startClient(userId, session);
        return res.json({ session });
      }
      await startClient(userId, session);
      return res.json({ session });
    }

    const { data: session, error } = await supabase
      .from('whatsapp_sessions')
      .insert({ user_id: userId, account_name: account_name || 'WhatsApp' })
      .select()
      .single();
    if (error) return jsonError(res, 500, 'Failed to create session');

    await startClient(userId, session);
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
});

app.get('/whatsapp/status', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return jsonError(res, 500, 'Failed to load sessions');
    res.json({ sessions: data });
  } catch (err) {
    next(err);
  }
});

app.post('/whatsapp/disconnect', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.body || {};
    if (!session_id) return jsonError(res, 400, 'session_id is required');

    await supabase
      .from('whatsapp_sessions')
      .update({ is_authenticated: false, qr_code: null, session_data: null })
      .eq('user_id', userId)
      .eq('id', session_id);

    const entry = clients.get(userId);
    if (entry && entry.sessionId === session_id) {
      await entry.client.destroy().catch(() => {});
      clients.delete(userId);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------- customers ----------------------------- */

app.get('/customers', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return jsonError(res, 500, 'Failed to load customers');
    res.json({ customers: data });
  } catch (err) {
    next(err);
  }
});

app.post('/customers', requireAuth, async (req, res, next) => {
  try {
    const { name, phone } = req.body || {};
    if (!name || !name.trim()) return jsonError(res, 400, 'Name is required');
    const normalized = normalizePhone(phone);
    if (!normalized) return jsonError(res, 400, 'A valid phone number (with country code) is required');

    const { data, error } = await supabase
      .from('customers')
      .insert({ user_id: req.user.id, name: name.trim(), phone: normalized })
      .select()
      .single();
    if (error) return jsonError(res, 500, 'Failed to create customer');
    res.status(201).json({ customer: data });
  } catch (err) {
    next(err);
  }
});

app.put('/customers/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, phone } = req.body || {};
    const normalized = normalizePhone(phone);
    if (!name || !name.trim()) return jsonError(res, 400, 'Name is required');
    if (!normalized) return jsonError(res, 400, 'A valid phone number (with country code) is required');

    const { data, error } = await supabase
      .from('customers')
      .update({ name: name.trim(), phone: normalized })
      .eq('user_id', req.user.id)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) return jsonError(res, 404, 'Customer not found');
    res.json({ customer: data });
  } catch (err) {
    next(err);
  }
});

app.delete('/customers/:id', requireAuth, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('user_id', req.user.id)
      .eq('id', req.params.id);
    if (error) return jsonError(res, 500, 'Failed to delete customer');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ------------------------- message templates ------------------------ */

app.get('/messages', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return jsonError(res, 500, 'Failed to load templates');
    res.json({ templates: data });
  } catch (err) {
    next(err);
  }
});

app.post('/messages', requireAuth, async (req, res, next) => {
  try {
    const { name, body } = req.body || {};
    if (!name || !name.trim()) return jsonError(res, 400, 'Template name is required');
    if (!body || !body.trim()) return jsonError(res, 400, 'Template body is required');

    const { data, error } = await supabase
      .from('message_templates')
      .insert({ user_id: req.user.id, name: name.trim(), body: body.trim() })
      .select()
      .single();
    if (error) return jsonError(res, 500, 'Failed to create template');
    res.status(201).json({ template: data });
  } catch (err) {
    next(err);
  }
});

app.put('/messages/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, body } = req.body || {};
    if (!name || !name.trim()) return jsonError(res, 400, 'Template name is required');
    if (!body || !body.trim()) return jsonError(res, 400, 'Template body is required');

    const { data, error } = await supabase
      .from('message_templates')
      .update({ name: name.trim(), body: body.trim() })
      .eq('user_id', req.user.id)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) return jsonError(res, 404, 'Template not found');
    res.json({ template: data });
  } catch (err) {
    next(err);
  }
});

app.delete('/messages/:id', requireAuth, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('user_id', req.user.id)
      .eq('id', req.params.id);
    if (error) return jsonError(res, 500, 'Failed to delete template');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------- schedules ---------------------------- */

app.get('/schedules', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('scheduled_sends')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return jsonError(res, 500, 'Failed to load schedules');
    res.json({ schedules: data });
  } catch (err) {
    next(err);
  }
});

app.post('/schedules', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { customer_id, template_id, send_type, schedule_time } = req.body || {};

    if (!customer_id || !template_id) {
      return jsonError(res, 400, 'customer_id and template_id are required');
    }
    if (!['immediate', 'once', 'daily', 'weekly'].includes(send_type)) {
      return jsonError(res, 400, "send_type must be one of immediate, once, daily, weekly");
    }

    const when = send_type === 'immediate'
      ? new Date().toISOString()
      : schedule_time
        ? new Date(schedule_time).toISOString()
        : null;
    if (!when) return jsonError(res, 400, 'schedule_time is required for this send type');

    const { data, error } = await supabase
      .from('scheduled_sends')
      .insert({ user_id: userId, customer_id, template_id, send_type, schedule_time: when, status: 'active' })
      .select()
      .single();
    if (error) return jsonError(res, 400, 'Failed to create schedule');

    if (send_type === 'immediate') {
      processSchedule(data).catch((err) => console.error('[schedule] immediate send failed:', err.message));
    }
    res.status(201).json({ schedule: data });
  } catch (err) {
    next(err);
  }
});

app.post('/schedules/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('scheduled_sends')
      .update({ status: 'cancelled' })
      .eq('user_id', req.user.id)
      .eq('id', req.params.id)
      .eq('status', 'active')
      .select()
      .single();
    if (error || !data) return jsonError(res, 404, 'Schedule not found or already resolved');
    res.json({ schedule: data });
  } catch (err) {
    next(err);
  }
});

/* --------------------------- delivery logs -------------------------- */

app.get('/logs', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('delivery_logs')
      .select('id, customer_id, message_body, error, sent_at, status, customers(name)')
      .eq('user_id', req.user.id)
      .order('sent_at', { ascending: false })
      .limit(200);
    if (error) return jsonError(res, 500, 'Failed to load logs');
    res.json({ logs: data });
  } catch (err) {
    next(err);
  }
});

/* ----------------------- scheduled job processor -------------------- */

async function processSchedule(s) {
  const entry = clients.get(s.user_id);
  const client = entry && entry.client;
  const ready = client && client.info && client.info.wid;

  if (!ready) {
    await logDelivery(s.user_id, s.customer_id, '', 'failed', 'WhatsApp not connected for this user');
    await supabase.from('scheduled_sends').update({ status: 'failed' }).eq('id', s.id);
    return;
  }

  const { data: customer } = await supabase.from('customers').select('phone').eq('id', s.customer_id).single();
  const { data: template } = await supabase.from('message_templates').select('body').eq('id', s.template_id).single();
  if (!customer || !template) {
    await logDelivery(s.user_id, s.customer_id, '', 'failed', 'Customer or template no longer exists');
    await supabase.from('scheduled_sends').update({ status: 'failed' }).eq('id', s.id);
    return;
  }

  const number = `${normalizePhone(customer.phone)}@c.us`;
  try {
    await client.sendMessage(number, template.body);
    await logDelivery(s.user_id, s.customer_id, template.body, 'success', null);
    const now = new Date().toISOString();
    if (s.send_type === 'once') {
      await supabase.from('scheduled_sends').update({ status: 'completed', last_sent: now }).eq('id', s.id);
    } else {
      const step = s.send_type === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      const next = new Date(new Date(s.schedule_time).getTime() + step).toISOString();
      await supabase.from('scheduled_sends').update({ schedule_time: next, last_sent: now }).eq('id', s.id);
    }
  } catch (err) {
    await logDelivery(s.user_id, s.customer_id, template.body, 'failed', String(err.message || err).slice(0, 500));
    await supabase.from('scheduled_sends').update({ status: 'failed' }).eq('id', s.id);
  }
}

async function logDelivery(userId, customerId, body, status, error) {
  const { error: err } = await supabase.from('delivery_logs').insert({
    user_id: userId,
    customer_id: customerId,
    message_body: body,
    sent_at: new Date().toISOString(),
    status,
    error,
  });
  if (err) console.error('[log] failed to write delivery log:', err.message);
}

async function processDue() {
  const { data: due, error } = await supabase
    .from('scheduled_sends')
    .select('*')
    .eq('status', 'active')
    .lte('schedule_time', new Date().toISOString());
  if (error) {
    console.error('[scheduler] failed to fetch due sends:', error.message);
    return;
  }
  for (const s of due) {
    await processSchedule(s).catch((err) => console.error('[scheduler] processing failed:', err.message));
  }
}

/* ----------------------------- misc -------------------------------- */

app.get(['/health', '/health/'], (req, res) => res.json({ ok: true }));

app.get('/', (req, res) => res.json({ ok: true, name: 'whatsapp-reminder-backend', health: '/health' }));

app.use((req, res) => jsonError(res, 404, 'Route not found'));

app.use((err, req, res, next) => {
  console.error(err);
  jsonError(res, 500, 'Internal server error');
});

const port = Number(PORT) || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  schedule.scheduleJob('* * * * *', processDue);
  processDue();
});
