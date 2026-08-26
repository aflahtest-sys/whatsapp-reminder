'use strict';

const recurrence = require('./recurrence');

/**
 * Decide what happens to a schedule after a run. Kept pure (no database, no
 * config import) so the rules can be tested directly -- see test/outcome.test.js.
 *
 * Two rules the previous version got wrong:
 *
 *  1. 'immediate' fell through to the recurring branch, picked up a 7-day step
 *     and stayed 'active'. A one-off "send now" quietly became a weekly message
 *     that repeated forever.
 *
 *  2. Any single send failure set status='failed', so one flaky moment killed a
 *     daily reminder permanently.
 *
 * @param {object} schedule  the row being processed
 * @param {{sent:number, failed:number, attempted:boolean}} result
 * @param {{graceHours:number, maxAttempts:number}} opts
 * @param {Date} now
 */
function decideOutcome(schedule, result, opts, now = new Date()) {
  const { sent = 0, attempted = false } = result || {};
  const oneOff = schedule.send_type === 'immediate' || schedule.send_type === 'once';

  if (oneOff) {
    if (sent > 0) {
      return { status: 'completed', last_sent: now.toISOString(), attempts: 0 };
    }
    if (!attempted) {
      // Nothing was even tried (WhatsApp offline). Retry on a later tick unless
      // the reminder is now so late that delivering it is worse than not.
      if (recurrence.isPastGrace(schedule.schedule_time, opts.graceHours, now)) {
        return { status: 'failed' };
      }
      return { status: 'active' };
    }
    const attempts = (schedule.attempts || 0) + 1;
    if (attempts >= opts.maxAttempts) return { status: 'failed', attempts };
    return { status: 'active', attempts };
  }

  // Recurring: daily or weekly.
  if (!attempted) {
    // Leave schedule_time alone so a brief disconnection retries in a minute
    // rather than silently skipping the whole day.
    return { status: 'active', attempts: (schedule.attempts || 0) + 1 };
  }

  const next = recurrence.nextOccurrence(schedule.send_type, schedule.schedule_time, now);
  return {
    status: 'active',
    schedule_time: next ? next.toISOString() : schedule.schedule_time,
    last_sent: sent > 0 ? now.toISOString() : schedule.last_sent,
    attempts: 0,
  };
}

module.exports = { decideOutcome };
