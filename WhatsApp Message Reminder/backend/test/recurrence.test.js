'use strict';

const test = require('node:test');
const assert = require('node:assert');

const r = require('../lib/recurrence');

const iso = (s) => new Date(s);

test('nextOccurrence advances a daily schedule by exactly one day when on time', () => {
  const from = iso('2026-08-26T09:00:00Z');
  const now = iso('2026-08-26T09:00:30Z');
  const next = r.nextOccurrence('daily', from, now);
  assert.strictEqual(next.toISOString(), '2026-08-27T09:00:00.000Z');
});

test('nextOccurrence skips past a three-day outage in one jump (no message burst)', () => {
  // This is the regression that mattered: the old code did schedule_time + 1 day,
  // which was still in the past, so the next tick fired again a minute later --
  // three messages to the same client in three minutes.
  const from = iso('2026-08-23T09:00:00Z');
  const now = iso('2026-08-26T10:00:00Z');
  const next = r.nextOccurrence('daily', from, now);
  assert.strictEqual(next.toISOString(), '2026-08-27T09:00:00.000Z');
  assert.ok(next.getTime() > now.getTime(), 'next run must be in the future');
});

test('nextOccurrence is always strictly in the future, however long the outage', () => {
  const from = iso('2025-01-01T06:30:00Z');
  const now = iso('2026-08-26T12:00:00Z');
  for (const type of ['daily', 'weekly']) {
    const next = r.nextOccurrence(type, from, now);
    assert.ok(next.getTime() > now.getTime(), `${type} must land in the future`);
    const step = type === 'daily' ? r.DAY_MS : r.WEEK_MS;
    assert.ok(next.getTime() - now.getTime() <= step, `${type} must not overshoot a period`);
    // The time of day must be preserved exactly.
    assert.strictEqual((next.getTime() - from.getTime()) % step, 0);
  }
});

test('nextOccurrence leaves a future schedule untouched', () => {
  const from = iso('2026-09-01T09:00:00Z');
  const now = iso('2026-08-26T09:00:00Z');
  assert.strictEqual(r.nextOccurrence('daily', from, now).toISOString(), from.toISOString());
});

test('nextOccurrence returns null for one-off send types', () => {
  assert.strictEqual(r.nextOccurrence('once', iso('2026-08-26T09:00:00Z')), null);
  assert.strictEqual(r.nextOccurrence('immediate', iso('2026-08-26T09:00:00Z')), null);
});

test('weekly advances by seven days, keeping the same weekday', () => {
  const from = iso('2026-08-26T09:00:00Z'); // a Wednesday
  const now = iso('2026-08-26T09:05:00Z');
  const next = r.nextOccurrence('weekly', from, now);
  assert.strictEqual(next.toISOString(), '2026-09-02T09:00:00.000Z');
  assert.strictEqual(next.getUTCDay(), from.getUTCDay());
});

test('missedRuns counts skipped periods without replaying them', () => {
  const from = iso('2026-08-23T09:00:00Z');
  const now = iso('2026-08-26T10:00:00Z');
  assert.strictEqual(r.missedRuns('daily', from, now), 3);
  assert.strictEqual(r.missedRuns('daily', iso('2026-08-26T09:00:00Z'), now), 0);
});

test('firstOccurrence for a daily send is always in the future', () => {
  const now = new Date('2026-08-26T12:00:00');
  const past = r.firstOccurrence('daily', 9, 0, null, now);
  assert.ok(past.getTime() > now.getTime());
  assert.strictEqual(past.getHours(), 9);

  const future = r.firstOccurrence('daily', 18, 30, null, now);
  assert.strictEqual(future.getDate(), now.getDate(), 'later today, not tomorrow');
  assert.strictEqual(future.getHours(), 18);
});

test('firstOccurrence for a weekly send lands on the chosen weekday', () => {
  const now = new Date('2026-08-26T12:00:00'); // Wednesday = 3
  for (let day = 0; day <= 6; day += 1) {
    const first = r.firstOccurrence('weekly', 9, 0, day, now);
    assert.strictEqual(first.getDay(), day, `expected weekday ${day}`);
    assert.ok(first.getTime() > now.getTime(), 'must be in the future');
    assert.ok(first.getTime() - now.getTime() <= r.WEEK_MS, 'within the next week');
  }
});

test('isPastGrace only trips after the window has elapsed', () => {
  const when = iso('2026-08-26T09:00:00Z');
  assert.strictEqual(r.isPastGrace(when, 24, iso('2026-08-26T20:00:00Z')), false);
  assert.strictEqual(r.isPastGrace(when, 24, iso('2026-08-27T10:00:00Z')), true);
});
