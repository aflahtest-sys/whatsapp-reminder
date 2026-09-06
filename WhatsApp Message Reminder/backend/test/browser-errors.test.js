'use strict';

const test = require('node:test');
const assert = require('node:assert');

// These two helpers decide whether a failed send is worth retrying or should be
// reported to the user as final, so they are worth pinning down precisely.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.invalid';
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef';

const { isTransientBrowserError, withTimeout } = require('../lib/whatsapp');

test('a crashed headless browser is recognised as retryable', () => {
  // This is the exact message that came back from production.
  const real = 'Protocol error (Runtime.callFunctionOn): Execution context was destroyed.';
  assert.strictEqual(isTransientBrowserError(real), true);

  for (const message of [
    'Execution context was destroyed, most likely because of a navigation.',
    'Target closed',
    'Session closed. Most likely the page has been closed.',
    'Protocol error: Connection closed',
    'Navigation failed because browser has disconnected!',
    'Page crashed!',
    'read ECONNRESET',
  ]) {
    assert.strictEqual(isTransientBrowserError(message), true, message);
  }
});

test('a genuinely bad number is NOT treated as a browser crash', () => {
  // Retrying these forever would be pointless and would look like spam.
  for (const message of [
    'This number is not registered on WhatsApp',
    'Invalid wid',
    'Cannot read properties of undefined',
    '',
    null,
  ]) {
    assert.strictEqual(isTransientBrowserError(message), false, String(message));
  }
});

test('withTimeout resolves normally when the work finishes in time', async () => {
  const result = await withTimeout(Promise.resolve('sent'), 1000, 'Send');
  assert.strictEqual(result, 'sent');
});

test('withTimeout rejects rather than hanging forever', async () => {
  const neverSettles = new Promise(() => {});
  await assert.rejects(() => withTimeout(neverSettles, 50, 'Send'), /Send timed out after/);
});

test('a timeout message is recognisable and not mistaken for a crash', async () => {
  try {
    await withTimeout(new Promise(() => {}), 20, 'Number lookup');
    assert.fail('should have rejected');
  } catch (err) {
    assert.match(err.message, /Number lookup timed out/);
    assert.strictEqual(isTransientBrowserError(err.message), false);
  }
});

test('withTimeout passes a real rejection through untouched', async () => {
  await assert.rejects(
    () => withTimeout(Promise.reject(new Error('number not registered')), 1000, 'Send'),
    /number not registered/
  );
});
