'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// A dedicated session directory so the test never touches a real profile.
const SESSION_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-locks-'));
process.env.WA_SESSION_PATH = SESSION_ROOT;
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.invalid';
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef';

const { clearProfileLocks } = require('../lib/whatsapp');

const USER = '8f998cc3-4ff1-4ec2-9f51-92cbed790c61';
const profileDir = path.join(SESSION_ROOT, `session-u-${USER}`);

function makeProfile() {
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });
  // Something that must survive, alongside the locks.
  fs.writeFileSync(path.join(profileDir, 'Default-credentials'), 'keep me');
}

test('a dangling SingletonLock symlink is removed', () => {
  makeProfile();
  // This is exactly what production left behind: a symlink naming a container
  // that no longer exists, so the target is unreachable.
  fs.symlinkSync('acc8428e423f-609', path.join(profileDir, 'SingletonLock'));

  const lockPath = path.join(profileDir, 'SingletonLock');
  assert.strictEqual(fs.existsSync(lockPath), false, 'existsSync lies about dangling symlinks');
  assert.ok(fs.lstatSync(lockPath), 'but the link is really there');

  assert.strictEqual(clearProfileLocks(USER), 1);
  assert.throws(() => fs.lstatSync(lockPath), /ENOENT/, 'lock must be gone');
});

test('all three lock files are cleared together', () => {
  makeProfile();
  fs.symlinkSync('host-123', path.join(profileDir, 'SingletonLock'));
  fs.writeFileSync(path.join(profileDir, 'SingletonCookie'), '');
  fs.writeFileSync(path.join(profileDir, 'SingletonSocket'), '');

  assert.strictEqual(clearProfileLocks(USER), 3);
  for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    assert.throws(() => fs.lstatSync(path.join(profileDir, name)), /ENOENT/, name);
  }
});

test('the logged-in session itself is never touched', () => {
  makeProfile();
  fs.symlinkSync('host-1', path.join(profileDir, 'SingletonLock'));
  clearProfileLocks(USER);

  // Losing this would mean a QR rescan on every restart -- the opposite of the fix.
  assert.strictEqual(
    fs.readFileSync(path.join(profileDir, 'Default-credentials'), 'utf8'),
    'keep me'
  );
  assert.ok(fs.existsSync(profileDir), 'the profile directory must survive');
});

test('a clean profile is left alone and reports nothing removed', () => {
  makeProfile();
  assert.strictEqual(clearProfileLocks(USER), 0);
  assert.ok(fs.existsSync(profileDir));
});

test('a user with no profile at all does not throw', () => {
  assert.strictEqual(clearProfileLocks('no-such-user-at-all'), 0);
});

test('it is safe to run twice in a row', () => {
  makeProfile();
  fs.symlinkSync('host-9', path.join(profileDir, 'SingletonLock'));
  assert.strictEqual(clearProfileLocks(USER), 1);
  assert.strictEqual(clearProfileLocks(USER), 0);
});
