'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  createResetToken,
  hashResetToken,
  isResetUsable,
  isTokenOlderThanPassword,
  buildResetUrl,
  safeEqual,
  RESET_TTL_MS,
} = require('../lib/tokens');

test('a reset token is long, random and url-safe', () => {
  const a = createResetToken();
  const b = createResetToken();

  assert.notStrictEqual(a.raw, b.raw, 'two tokens must never match');
  assert.ok(a.raw.length >= 40, 'token should carry ~256 bits');
  assert.match(a.raw, /^[A-Za-z0-9_-]+$/, 'must survive being put in a URL unescaped');
  assert.strictEqual(encodeURIComponent(a.raw), a.raw, 'no characters needing escaping');
});

test('the raw token is never what gets stored', () => {
  const token = createResetToken();
  assert.notStrictEqual(token.hash, token.raw);
  assert.match(token.hash, /^[0-9a-f]{64}$/, 'stored value is a sha256 hex digest');
  // A stolen database gives you hashes, and a hash cannot be emailed to anyone.
  assert.strictEqual(hashResetToken(token.raw), token.hash, 'lookup by hash must work');
});

test('hashing is stable and sensitive to a single character', () => {
  assert.strictEqual(hashResetToken('abc'), hashResetToken('abc'));
  assert.notStrictEqual(hashResetToken('abc'), hashResetToken('abd'));
});

test('a token expires an hour out', () => {
  const now = new Date('2026-08-26T09:00:00Z');
  const token = createResetToken(now);
  assert.strictEqual(token.expiresAt.getTime() - now.getTime(), RESET_TTL_MS);
  assert.strictEqual(RESET_TTL_MS, 3600000);
});

test('isResetUsable accepts only a fresh, unused row', () => {
  const now = new Date('2026-08-26T09:00:00Z');
  const future = new Date('2026-08-26T09:30:00Z').toISOString();
  const past = new Date('2026-08-26T08:30:00Z').toISOString();

  assert.strictEqual(isResetUsable({ expires_at: future, used_at: null }, now), true);
  assert.strictEqual(isResetUsable({ expires_at: past, used_at: null }, now), false, 'expired');
  assert.strictEqual(
    isResetUsable({ expires_at: future, used_at: now.toISOString() }, now),
    false,
    'already used - a reset link must work exactly once'
  );
  assert.strictEqual(isResetUsable(null, now), false, 'no matching row');
  assert.strictEqual(isResetUsable({ expires_at: 'nonsense', used_at: null }, now), false);
});

test('tokens issued before a password change are rejected', () => {
  const changed = '2026-08-26T09:00:00Z';
  const before = Math.floor(new Date('2026-08-26T08:00:00Z').getTime() / 1000);
  const after = Math.floor(new Date('2026-08-26T10:00:00Z').getTime() / 1000);

  assert.strictEqual(isTokenOlderThanPassword(before, changed), true, 'old session must be ejected');
  assert.strictEqual(isTokenOlderThanPassword(after, changed), false, 'new session stays');
});

test('the session that changed the password is not signed out by its own change', () => {
  // JWT iat is whole seconds, so a token minted in the same second as the change
  // has a timestamp fractionally in the past. Without slack the user would be
  // logged straight back out by the action they just took.
  const changedAt = new Date('2026-08-26T09:00:00.850Z');
  const issuedAt = Math.floor(changedAt.getTime() / 1000);
  assert.strictEqual(isTokenOlderThanPassword(issuedAt, changedAt), false);
});

test('an account that never changed its password keeps working', () => {
  const iat = Math.floor(Date.now() / 1000);
  assert.strictEqual(isTokenOlderThanPassword(iat, null), false);
  assert.strictEqual(isTokenOlderThanPassword(iat, undefined), false);
  assert.strictEqual(isTokenOlderThanPassword(undefined, '2026-08-26T09:00:00Z'), false);
});

test('the reset link is built correctly whatever the app url looks like', () => {
  const token = 'abc-123_XYZ';
  assert.strictEqual(
    buildResetUrl('https://app.vercel.app', token),
    'https://app.vercel.app/reset-password?token=abc-123_XYZ'
  );
  // A trailing slash on APP_URL must not produce a double slash.
  assert.strictEqual(
    buildResetUrl('https://app.vercel.app/', token),
    'https://app.vercel.app/reset-password?token=abc-123_XYZ'
  );
  assert.strictEqual(
    buildResetUrl('https://app.vercel.app///', token),
    'https://app.vercel.app/reset-password?token=abc-123_XYZ'
  );
});

test('a real generated token round-trips through a URL unchanged', () => {
  for (let i = 0; i < 50; i += 1) {
    const { raw } = createResetToken();
    const url = buildResetUrl('https://x.test', raw);
    const parsed = new URL(url).searchParams.get('token');
    assert.strictEqual(parsed, raw, 'token must survive the trip to the browser and back');
    assert.strictEqual(hashResetToken(parsed), hashResetToken(raw));
  }
});

test('safeEqual compares without leaking length or content by timing', () => {
  assert.strictEqual(safeEqual('secret', 'secret'), true);
  assert.strictEqual(safeEqual('secret', 'secreT'), false);
  assert.strictEqual(safeEqual('secret', 'longer-secret'), false);
  assert.strictEqual(safeEqual('', ''), true);
  assert.strictEqual(safeEqual(null, undefined), true, 'both empty');
});
