'use strict';

const config = require('./config');
const supabase = require('./db');
const whatsapp = require('./whatsapp');
const recurrence = require('./recurrence');
const { decideOutcome } = require('./outcome');
const { renderForCustomer } = require('./template');

const { scheduler: opts } = config;

// Guards against a tick starting while the previous one is still sending.
// A bulk send paced at ~10s per message easily outlives the one-minute timer,
// and the old code would happily re-read the same due rows and send them twice.
let running = false;
let lastRunAt = null;
let lastRunSummary = null;

function log(...args) {
  console.log('[scheduler]', ...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Randomised gap between messages. Uniform bursts look like a bot to WhatsApp. */
function pacingDelay() {
  const { minGapMs, maxGapMs } = opts;
  return minGapMs + Math.floor(Math.random() * Math.max(1, maxGapMs - minGapMs));
}

/* --------------------------- claiming work --------------------------- */

/**
 * Atomically take ownership of a schedule.
 *
 * Postgres locks the row for the duration of the UPDATE, so if two workers race,
 * exactly one of them matches `locked_at is null` and gets a row back; the other
 * matches nothing. `locked_at` older than the timeout is treated as abandoned,
 * which recovers jobs orphaned by a crash mid-send.
 */
async function claim(schedule) {
  const cutoff = new Date(Date.now() - opts.lockTimeoutMs).toISOString();

  const { data, error } = await supabase
    .from('scheduled_sends')
    .update({ locked_at: new Date().toISOString() })
    .eq('id', schedule.id)
    .eq('status', 'active')
    // Fencing: only claim the row if it still sits at the exact run time we read
    // in processDue. Without this, a worker holding a slow batch can finish and
    // reschedule the row, and a second worker still walking its own (now stale)
    // list re-claims it and messages everybody a second time.
    .eq('schedule_time', schedule.schedule_time)
    .or(`locked_at.is.null,locked_at.lt.${cutoff}`)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[scheduler] claim failed:', error.message);
    return null;
  }
  return data || null;
}

/**
 * Refresh the lock and confirm we still own the job.
 * Returns false once the schedule stops being active -- which is how a Cancel
 * pressed halfway through a 40-person send actually stops the send.
 */
async function touchLock(scheduleId) {
  const { data, error } = await supabase
    .from('scheduled_sends')
    .update({ locked_at: new Date().toISOString() })
    .eq('id', scheduleId)
    .eq('status', 'active')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[scheduler] lock refresh failed:', error.message);
    return true; // a transient DB error should not abandon a half-sent batch
  }
  return Boolean(data);
}

/**
 * Write the run's outcome and drop the lock.
 *
 * The status patch is guarded on the row still being active, so a schedule the
 * user cancelled (or deleted) while it was running is never resurrected into
 * 'active' or quietly flipped to 'completed'.
 */
async function release(scheduleId, patch = {}) {
  const { data, error } = await supabase
    .from('scheduled_sends')
    .update({ locked_at: null, ...patch })
    .eq('id', scheduleId)
    .eq('status', 'active')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[scheduler] release failed:', error.message);
    return;
  }

  // No row matched: the schedule was cancelled or deleted mid-run. Leave its
  // status alone and just make sure no stale lock is left behind.
  if (!data) {
    await supabase.from('scheduled_sends').update({ locked_at: null }).eq('id', scheduleId);
  }
}

/* ---------------------------- recipients ----------------------------- */

async function resolveRecipients(schedule) {
  const base = supabase
    .from('customers')
    .select('id, name, phone, tags')
    .eq('user_id', schedule.user_id);

  let query;
  if (schedule.target_type === 'tag') {
    query = base.contains('tags', [schedule.target_tag]);
  } else if (schedule.target_type === 'all') {
    query = base;
  } else {
    query = base.eq('id', schedule.customer_id);
  }

  // An explicit cap, so a very large list fails loudly in the log instead of
  // being silently truncated by PostgREST's own max-rows setting.
  const { data, error } = await query
    .order('created_at', { ascending: true })
    .limit(opts.maxRecipientsPerRun + 1);

  if (error) {
    console.error('[scheduler] could not resolve recipients:', error.message);
    return null;
  }

  const rows = data || [];
  if (rows.length > opts.maxRecipientsPerRun) {
    console.warn(
      `[scheduler] schedule ${schedule.id} matched more than ${opts.maxRecipientsPerRun} customers; ` +
        `only the first ${opts.maxRecipientsPerRun} will be messaged this run`
    );
    return rows.slice(0, opts.maxRecipientsPerRun);
  }
  return rows;
}

async function logDelivery(entry) {
  const row = {
    user_id: entry.userId,
    customer_id: entry.customerId || null,
    schedule_id: entry.scheduleId || null,
    message_body: entry.body || '',
    sent_at: new Date().toISOString(),
    status: entry.status,
    error: entry.error || null,
  };

  const { error } = await supabase.from('delivery_logs').insert(row);
  if (!error) return;

  // 23503 = foreign key violation: the schedule (or customer) was deleted while
  // this batch was running. The delivery still happened, so keep the record --
  // losing history because a row was tidied up would be worse.
  if (error.code === '23503') {
    const { error: retryError } = await supabase
      .from('delivery_logs')
      .insert({ ...row, schedule_id: null, customer_id: null });
    if (!retryError) return;
    console.error('[scheduler] delivery log retry failed:', retryError.message);
    return;
  }

  console.error('[scheduler] failed to write delivery log:', error.message);
}

/* ------------------------------ running ------------------------------ */

async function runSchedule(schedule) {
  const result = { sent: 0, failed: 0, attempted: false, skipped: null };

  const { data: template, error: templateError } = await supabase
    .from('message_templates')
    .select('id, body')
    .eq('id', schedule.template_id)
    .eq('user_id', schedule.user_id)
    .maybeSingle();

  if (templateError || !template) {
    await logDelivery({
      userId: schedule.user_id,
      customerId: schedule.customer_id,
      scheduleId: schedule.id,
      status: 'failed',
      error: 'The message template for this schedule no longer exists',
    });
    await release(schedule.id, { status: 'failed', last_error: 'Template deleted' });
    return { ...result, skipped: 'template_missing' };
  }

  const recipients = await resolveRecipients(schedule);
  if (recipients === null) {
    await release(schedule.id, { last_error: 'Could not load recipients' });
    return { ...result, skipped: 'recipients_error' };
  }

  if (!recipients.length) {
    // An empty group is not a failure; the group may fill up before next week.
    const outcome = decideOutcome(schedule, { sent: 0, failed: 0, attempted: true }, opts);
    await release(schedule.id, { ...outcome, last_error: 'No matching customers' });
    return { ...result, skipped: 'no_recipients' };
  }

  if (!whatsapp.isReady(whatsapp.getEntry(schedule.user_id))) {
    const outcome = decideOutcome(schedule, result, opts);
    await release(schedule.id, {
      ...outcome,
      last_error: 'WhatsApp is not connected for this account',
    });
    if (outcome.status === 'failed') {
      await logDelivery({
        userId: schedule.user_id,
        customerId: schedule.customer_id,
        scheduleId: schedule.id,
        status: 'failed',
        error: `WhatsApp stayed disconnected for over ${opts.graceHours}h; reminder not sent`,
      });
    }
    return { ...result, skipped: 'not_connected' };
  }

  const missed = recurrence.missedRuns(schedule.send_type, schedule.schedule_time);
  if (missed > 1) {
    log(`schedule ${schedule.id} missed ${missed - 1} run(s) while offline; sending once, not ${missed}`);
  }

  let lastError = null;

  for (let i = 0; i < recipients.length; i += 1) {
    const customer = recipients[i];
    const body = renderForCustomer(template.body, customer, { timezone: config.timezone });

    result.attempted = true;
    const outcome = await whatsapp.sendMessage(schedule.user_id, customer.phone, body);

    await logDelivery({
      userId: schedule.user_id,
      customerId: customer.id,
      scheduleId: schedule.id,
      body,
      status: outcome.ok ? 'success' : 'failed',
      error: outcome.ok ? null : outcome.error,
    });

    if (outcome.ok) {
      result.sent += 1;
    } else {
      result.failed += 1;
      lastError = outcome.error;
      // The connection dropped mid-batch; stop rather than pile up failures.
      if (!outcome.permanent && !whatsapp.isReady(whatsapp.getEntry(schedule.user_id))) {
        log(`connection lost during schedule ${schedule.id}; stopping after ${i + 1} recipient(s)`);
        break;
      }
    }

    if (i < recipients.length - 1) {
      // Refreshing the lock doubles as a cancellation check: if the user pressed
      // Cancel while we were working through the list, stop here instead of
      // messaging the remaining people.
      const stillOurs = await touchLock(schedule.id);
      if (!stillOurs) {
        log(`schedule ${schedule.id} was cancelled mid-run; stopped after ${i + 1} recipient(s)`);
        await release(schedule.id, {});
        return result;
      }
      await sleep(pacingDelay());
    }
  }

  const outcome = decideOutcome(schedule, result, opts);
  await release(schedule.id, { ...outcome, last_error: lastError });
  return result;
}

/* ------------------------------- tick -------------------------------- */

async function processDue() {
  if (running) {
    log('previous run still in progress, skipping this tick');
    return { skipped: true };
  }
  running = true;
  lastRunAt = new Date();

  const summary = { schedules: 0, sent: 0, failed: 0 };

  try {
    const { data: due, error } = await supabase
      .from('scheduled_sends')
      .select('*')
      .eq('status', 'active')
      .lte('schedule_time', new Date().toISOString())
      .order('schedule_time', { ascending: true })
      .limit(opts.batchSize);

    if (error) {
      console.error('[scheduler] failed to fetch due sends:', error.message);
      return { error: error.message };
    }

    // Pacing is a per-WhatsApp-account concern, so schedules must run one at a
    // time *within* an account -- but there is no reason one user's 300-person
    // send should hold up everybody else's reminders for the next hour. Group by
    // user, run the groups concurrently, stay sequential inside each group.
    const byUser = new Map();
    for (const schedule of due || []) {
      if (!byUser.has(schedule.user_id)) byUser.set(schedule.user_id, []);
      byUser.get(schedule.user_id).push(schedule);
    }

    await Promise.all(
      [...byUser.values()].map(async (userSchedules) => {
        // One check per account, not one per schedule. With WhatsApp offline
        // every due schedule used to be claimed, examined and released on every
        // single tick -- twenty-five rows a minute, forever, hammering both the
        // database and a browser that was already struggling. Nothing can be
        // sent while the account is offline, so skip the whole group and let
        // the next tick try again.
        const userId = userSchedules[0].user_id;
        if (!whatsapp.isReady(whatsapp.getEntry(userId))) {
          const expired = userSchedules.filter(
            (s) =>
              (s.send_type === 'immediate' || s.send_type === 'once') &&
              recurrence.isPastGrace(s.schedule_time, opts.graceHours)
          );

          if (!expired.length) {
            log(
              `WhatsApp offline for user ${userId}; leaving ${userSchedules.length} schedule(s) for later`
            );
            return;
          }
          // Only the ones that have waited too long need touching now.
          userSchedules = expired;
        }

        for (const schedule of userSchedules) {
          const claimed = await claim(schedule);
          if (!claimed) continue; // another worker got it, or it was cancelled

          summary.schedules += 1;
          try {
            const result = await runSchedule(claimed);
            summary.sent += result.sent;
            summary.failed += result.failed;
          } catch (err) {
            console.error('[scheduler] processing failed for', claimed.id, err.message);
            await release(claimed.id, { last_error: String(err.message || err).slice(0, 500) });
          }
        }
      })
    );

    if (summary.schedules) {
      log(`ran ${summary.schedules} schedule(s): ${summary.sent} sent, ${summary.failed} failed`);
    }
    lastRunSummary = summary;
    return summary;
  } finally {
    running = false;
  }
}

/** Release locks left behind by a process that died mid-send. */
async function recoverStaleLocks() {
  const cutoff = new Date(Date.now() - opts.lockTimeoutMs).toISOString();
  const { data, error } = await supabase
    .from('scheduled_sends')
    .update({ locked_at: null })
    .eq('status', 'active')
    .lt('locked_at', cutoff)
    .select('id');

  if (error) {
    console.error('[scheduler] stale lock recovery failed:', error.message);
    return 0;
  }
  if (data && data.length) log(`recovered ${data.length} stale lock(s)`);
  return data ? data.length : 0;
}

function status() {
  return { running, lastRunAt, lastRunSummary };
}

module.exports = { processDue, recoverStaleLocks, decideOutcome, status };
