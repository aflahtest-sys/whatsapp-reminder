'use strict';

/**
 * Recurrence maths.
 *
 * Note on daylight saving: steps are fixed millisecond amounts, and
 * `schedule_time` is an absolute instant chosen in the user's local timezone.
 * In a timezone that observes DST, a 09:00 reminder would shift to 08:00 (or
 * 10:00) after the clock change and stay there. Oman -- Asia/Muscat, the
 * default -- has no DST, so this is exact. If you roll this out somewhere that
 * does observe it, recurrence needs to be recomputed against a stored wall-clock
 * time plus timezone rather than a fixed offset.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function stepFor(sendType) {
  if (sendType === 'daily') return DAY_MS;
  if (sendType === 'weekly') return WEEK_MS;
  return null;
}

function isRecurring(sendType) {
  return sendType === 'daily' || sendType === 'weekly';
}

/**
 * How many runs were missed because the server was down (or the schedule sat
 * overdue). Purely informational -- we never replay them.
 */
function missedRuns(sendType, from, now = new Date()) {
  const step = stepFor(sendType);
  if (!step) return 0;
  const start = new Date(from).getTime();
  if (!Number.isFinite(start)) return 0;
  const diff = now.getTime() - start;
  return diff <= 0 ? 0 : Math.floor(diff / step);
}

/**
 * The next run strictly in the future.
 *
 * The bug this replaces: the old code did `next = schedule_time + one step`.
 * After three days of downtime that lands you *still in the past*, so the next
 * scheduler tick fires again, and again -- three messages to the same client in
 * three minutes. Here we skip straight past every missed slot in one jump, so a
 * client gets at most one message per period no matter how long the outage was.
 */
function nextOccurrence(sendType, from, now = new Date()) {
  const step = stepFor(sendType);
  if (!step) return null;

  const start = new Date(from).getTime();
  if (!Number.isFinite(start)) return null;

  const nowMs = now.getTime();
  if (start > nowMs) return new Date(start);

  const skips = Math.floor((nowMs - start) / step) + 1;
  return new Date(start + skips * step);
}

/**
 * First run for a new schedule, given a wall-clock time of day (and weekday for
 * weekly sends). Always returns a moment in the future.
 *
 * @param {string} sendType  'daily' | 'weekly'
 * @param {number} hours     0-23, in the server's local timezone
 * @param {number} minutes   0-59
 * @param {number|null} weekday  0 = Sunday .. 6 = Saturday, weekly only
 */
function firstOccurrence(sendType, hours, minutes, weekday = null, now = new Date()) {
  const target = new Date(now.getTime());
  target.setHours(hours, minutes, 0, 0);

  if (sendType === 'weekly' && weekday != null) {
    const delta = (weekday - target.getDay() + 7) % 7;
    target.setDate(target.getDate() + delta);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 7);
    return target;
  }

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + (sendType === 'weekly' ? 7 : 1));
  }
  return target;
}

/**
 * A one-off send that never managed to go out is eventually pointless -- a
 * reminder delivered five days late is worse than none. Past the grace window
 * we stop trying.
 */
function isPastGrace(scheduleTime, graceHours, now = new Date()) {
  const t = new Date(scheduleTime).getTime();
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t > graceHours * 60 * 60 * 1000;
}

module.exports = {
  DAY_MS,
  WEEK_MS,
  DAY_NAMES,
  stepFor,
  isRecurring,
  missedRuns,
  nextOccurrence,
  firstOccurrence,
  isPastGrace,
};
