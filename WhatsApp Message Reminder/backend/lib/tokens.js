'use strict';

const crypto = require('crypto');

// One hour. Long enough to find the email in a spam folder, short enough that a
// link sitting in an inbox forever is not a standing key to the account.
const RESET_TTL_MS = 60 * 60 * 1000;

/**
 * Make a password-reset token.
 *
 * Returns the raw token (goes in the email, never stored) and its SHA-256 hash
 * (stored in the database, never emailed). If the database is ever dumped, the
 * hashes in it cannot be turned back into working reset links.
 *
 * SHA-256 rather than bcrypt is correct here: the token is 256 bits of random
 * data, so there is no dictionary to attack and nothing to slow down.
 */
function createResetToken(now = new Date()) {
  const raw = crypto.randomBytes(32).toString('base64url');
  return {
    raw,
    hash: hashResetToken(raw),
    expiresAt: new Date(now.getTime() + RESET_TTL_MS),
  };
}

function hashResetToken(raw) {
  return crypto.createHash('sha256').update(String(raw), 'utf8').digest('hex');
}

/** Is this stored reset row still usable? */
function isResetUsable(row, now = new Date()) {
  if (!row) return false;
  if (row.used_at) return false;
  const expires = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expires)) return false;
  return expires > now.getTime();
}

/**
 * Reject a token that was issued before the account's password last changed.
 *
 * Resetting a password should end sessions elsewhere, but JWTs are stateless and
 * cannot be withdrawn. Comparing the token's issued-at against the recorded
 * change time achieves the same result without a database lookup on every
 * single request.
 */
function isTokenOlderThanPassword(issuedAtSeconds, passwordChangedAt) {
  if (!passwordChangedAt) return false;
  if (!Number.isFinite(issuedAtSeconds)) return false;
  const changed = new Date(passwordChangedAt).getTime();
  if (!Number.isFinite(changed)) return false;
  // JWT `iat` is whole seconds, so allow a second of slack to avoid logging out
  // the very session that just changed the password.
  return issuedAtSeconds * 1000 < changed - 1000;
}

/** The link that goes in the email. */
function buildResetUrl(appUrl, rawToken) {
  const base = String(appUrl || '').replace(/\/+$/, '');
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/** Constant-time compare, for anywhere a secret is checked by value. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  RESET_TTL_MS,
  createResetToken,
  hashResetToken,
  isResetUsable,
  isTokenOlderThanPassword,
  buildResetUrl,
  safeEqual,
};
