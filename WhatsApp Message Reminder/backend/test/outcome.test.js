'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { decideOutcome } = require('../lib/outcome');

const OPTS = { graceHours: 24, maxAttempts: 5 };
const NOW = new Date('2026-08-26T09:00:10Z');

const schedule = (over = {}) => ({
  id: 's1',
  send_type: 'daily',
  schedule_time: '2026-08-26T09:00:00Z',
  attempts: 0,
  last_sent: null,
  ...over,
});

test('an immediate send completes and never repeats', () => {
  // The old code sent this into the recurring branch, gave it a 7-day step and
  // left status='active' -- so "send now" became a weekly message forever.
  const out = decideOutcome(
    schedule({ send_type: 'immediate' }),
    { sent: 1, failed: 0, attempted: true },
    OPTS,
    NOW
  );
  assert.strictEqual(out.status, 'completed');
  assert.strictEqual(out.schedule_time, undefined, 'must not be rescheduled');
});

test('a once send completes after delivery', () => {
  const out = decideOutcome(
    schedule({ send_type: 'once' }),
    { sent: 1, failed: 0, attempted: true },
    OPTS,
    NOW
  );
  assert.strictEqual(out.status, 'completed');
});

test('a daily send survives a failed delivery and moves to tomorrow', () => {
  const out = decideOutcome(schedule(), { sent: 0, failed: 1, attempted: true }, OPTS, NOW);
  assert.strictEqual(out.status, 'active', 'one bad send must not kill a recurring reminder');
  assert.strictEqual(out.schedule_time, '2026-08-27T09:00:00.000Z');
});

test('a daily send that could not be attempted keeps its slot and retries', () => {
  const out = decideOutcome(schedule(), { sent: 0, failed: 0, attempted: false }, OPTS, NOW);
  assert.strictEqual(out.status, 'active');
  assert.strictEqual(out.schedule_time, undefined, 'must not skip the day over a brief outage');
  assert.strictEqual(out.attempts, 1);
});

test('a partially delivered bulk send still advances and records last_sent', () => {
  const out = decideOutcome(schedule(), { sent: 8, failed: 2, attempted: true }, OPTS, NOW);
  assert.strictEqual(out.status, 'active');
  assert.strictEqual(out.schedule_time, '2026-08-27T09:00:00.000Z');
  assert.strictEqual(out.last_sent, NOW.toISOString());
  assert.strictEqual(out.attempts, 0, 'attempt counter resets after a working run');
});

test('a one-off send retries while WhatsApp is offline, inside the grace window', () => {
  const out = decideOutcome(
    schedule({ send_type: 'once' }),
    { sent: 0, failed: 0, attempted: false },
    OPTS,
    new Date('2026-08-26T20:00:00Z')
  );
  assert.strictEqual(out.status, 'active');
});

test('a one-off send gives up once the grace window has passed', () => {
  const out = decideOutcome(
    schedule({ send_type: 'once' }),
    { sent: 0, failed: 0, attempted: false },
    OPTS,
    new Date('2026-08-27T10:00:00Z')
  );
  assert.strictEqual(out.status, 'failed');
});

test('a one-off send fails only after maxAttempts real failures', () => {
  for (let attempts = 0; attempts < OPTS.maxAttempts - 1; attempts += 1) {
    const out = decideOutcome(
      schedule({ send_type: 'once', attempts }),
      { sent: 0, failed: 1, attempted: true },
      OPTS,
      NOW
    );
    assert.strictEqual(out.status, 'active', `attempt ${attempts + 1} should retry`);
  }
  const final = decideOutcome(
    schedule({ send_type: 'once', attempts: OPTS.maxAttempts - 1 }),
    { sent: 0, failed: 1, attempted: true },
    OPTS,
    NOW
  );
  assert.strictEqual(final.status, 'failed');
});

test('repeated ticks on a recurring schedule never produce a burst', () => {
  // Simulate three days of downtime, then a tick every minute for an hour.
  let row = schedule({ schedule_time: '2026-08-23T09:00:00Z' });
  let deliveries = 0;
  let clock = new Date('2026-08-26T10:00:00Z');

  for (let minute = 0; minute < 60; minute += 1) {
    const due = new Date(row.schedule_time).getTime() <= clock.getTime();
    if (due) {
      deliveries += 1;
      const out = decideOutcome(row, { sent: 1, failed: 0, attempted: true }, OPTS, clock);
      row = { ...row, ...out };
    }
    clock = new Date(clock.getTime() + 60_000);
  }

  assert.strictEqual(deliveries, 1, 'exactly one message after an outage, not one per missed day');
});
