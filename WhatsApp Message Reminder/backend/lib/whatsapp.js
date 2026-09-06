'use strict';

const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');

const config = require('./config');
const supabase = require('./db');
const { toWhatsAppId } = require('./phone');

/**
 * One live WhatsApp connection per user, kept in this process.
 *
 * The version of whatsapp-web.js installed here (1.34.x) removed the old
 * `new Client({ session })` option entirely -- src/authStrategies contains only
 * LocalAuth, RemoteAuth and NoAuth. Passing `session` was silently ignored, which
 * meant the previous implementation ran with NoAuth: every restart demanded a
 * fresh QR scan, and the `authenticated` event (which no longer carries a session
 * argument) wrote `undefined` into the session_data column.
 *
 * LocalAuth persists the logged-in browser profile to disk instead. On Railway
 * that directory MUST be a mounted volume or a redeploy wipes the login.
 */

const clients = new Map(); // userId -> ClientEntry

const STATES = {
  STARTING: 'starting',
  QR: 'awaiting_qr_scan',
  AUTHENTICATED: 'authenticated',
  READY: 'ready',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed',
};

function log(...args) {
  console.log('[wa]', ...args);
}

function ensureSessionDir() {
  try {
    fs.mkdirSync(config.waSessionPath, { recursive: true });
  } catch (err) {
    console.error('[wa] could not create session directory:', err.message);
  }
}

async function updateSession(sessionId, patch) {
  const { error } = await supabase.from('whatsapp_sessions').update(patch).eq('id', sessionId);
  if (error) console.error('[wa] failed to update session row:', error.message);
}

function setState(entry, state) {
  entry.state = state;
  entry.stateChangedAt = Date.now();
}

/**
 * How to resolve the WhatsApp Web version.
 *
 * A cached copy on disk can go stale and stop matching what WhatsApp actually
 * serves, which produces exactly the "Execution context was destroyed" failures
 * this app was seeing. Default is therefore to fetch fresh each time. Set
 * WA_WEB_CACHE=local to cache, or WA_WEB_VERSION_URL to pin a known-good build.
 */
function webVersionOptions() {
  const mode = config.waWebCache;

  if (mode === 'remote' && config.waWebVersionUrl) {
    return { webVersionCache: { type: 'remote', remotePath: config.waWebVersionUrl } };
  }
  if (mode === 'local') {
    return { webVersionCache: { type: 'local', path: path.join(config.waSessionPath, '.wwebjs_cache') } };
  }
  return { webVersionCache: { type: 'none' } };
}

/** Puppeteer failures that mean "the browser died", not "the message is bad". */
const TRANSIENT = /execution context was destroyed|target closed|session closed|protocol error|detached frame|browser has disconnected|navigation|page crashed|websocket|econnreset/i;

function isTransientBrowserError(message) {
  return TRANSIENT.test(String(message || ''));
}

/** Never let a hung page hold an HTTP request open forever. */
function withTimeout(promise, ms, label) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

function buildClient(userId, sessionId) {
  ensureSessionDir();

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `u-${userId}`,
      dataPath: config.waSessionPath,
    }),
    puppeteer: {
      headless: true,
      executablePath: config.puppeteerExecutablePath,
      // On a CPU-starved container Chromium cannot always answer a devtools
      // call inside the default window, and puppeteer gives up with
      // "Runtime.callFunctionOn timed out". Slow is better than failed.
      protocolTimeout: 240_000,
      // Chromium is the memory hog in this container. When it is squeezed, the
      // renderer is killed and any send in flight dies with
      // "Execution context was destroyed" -- so trim everything not needed to
      // render one chat page.
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-accelerated-2d-canvas',
        '--disable-breakpad',
        '--disable-sync',
        '--mute-audio',
        '--no-zygote',
      ],
    },
    ...webVersionOptions(),
    qrMaxRetries: 0,
    takeoverOnConflict: true,
  });

  const entry = { client, sessionId, userId, state: STATES.STARTING, stateChangedAt: Date.now() };

  client.on('qr', (qr) => {
    setState(entry, STATES.QR);
    QRCode.toDataURL(qr, { margin: 1, width: 400 })
      .then((url) => updateSession(sessionId, { qr_code: url, is_authenticated: false }))
      .catch((err) => console.error('[wa] QR encode failed:', err.message));
  });

  // Note: in this version the 'authenticated' event receives no arguments. There
  // is nothing to serialise -- LocalAuth has already written the session to disk.
  client.on('authenticated', () => {
    setState(entry, STATES.AUTHENTICATED);
    log(`authenticated for user ${userId}`);
  });

  client.on('ready', () => {
    setState(entry, STATES.READY);
    reconnectAttempts.delete(userId); // a good connection resets the backoff
    updateSession(sessionId, {
      is_authenticated: true,
      qr_code: null,
      last_ready_at: new Date().toISOString(),
    });
    log(`ready for user ${userId}`);
  });

  client.on('auth_failure', (msg) => {
    setState(entry, STATES.FAILED);
    entry.lastError = String(msg || 'authentication failed');
    updateSession(sessionId, { is_authenticated: false });
    console.error('[wa] auth_failure for user', userId, msg);
  });

  client.on('disconnected', async (reason) => {
    setState(entry, STATES.DISCONNECTED);
    entry.lastError = String(reason || 'disconnected');

    // Remove ourselves BEFORE any await, and only if the map still points at
    // this entry. Deleting by key after an await can evict a newer client that
    // a restart put there in the meantime, leaving a live connection invisible
    // to isReady() while a second browser starts up against the same profile.
    forgetEntry(userId, entry);
    console.warn('[wa] disconnected for user', userId, reason);

    await updateSession(sessionId, { is_authenticated: false });

    // Destroy the puppeteer browser so it does not leak.
    await client.destroy().catch(() => {});

    // A phone that went offline overnight is not the same as a user unlinking
    // the device. LocalAuth still holds valid credentials on disk, so retry --
    // otherwise the account stays dark until somebody notices and rescans, and
    // every reminder it owns quietly stops.
    if (isLogout(reason)) {
      console.warn('[wa] user logged out on the phone; not reconnecting');
      return;
    }
    scheduleReconnect(userId, sessionId);
  });

  return entry;
}

/** Reasons that mean "the user deliberately unlinked", so do not reconnect. */
function isLogout(reason) {
  return /logout|unpaired|conflict/i.test(String(reason || ''));
}

const reconnectTimers = new Map();
const reconnectAttempts = new Map(); // userId -> consecutive failures

/** Drop an entry from the map only if it is still the one we think it is. */
function forgetEntry(userId, entry) {
  if (clients.get(userId) === entry) clients.delete(userId);
}

/**
 * Try again later, backing off each time.
 *
 * The attempt counter lives outside this function on purpose. startClient does
 * not await initialize(), so a failed reconnect surfaces asynchronously in
 * startClient's own catch -- which calls back in here. Passing `attempt` as an
 * argument would reset it to 1 every time and the delay would never grow.
 */
function scheduleReconnect(userId, sessionId) {
  if (reconnectTimers.has(userId)) return;

  const attempt = (reconnectAttempts.get(userId) || 0) + 1;
  reconnectAttempts.set(userId, attempt);

  // Back off: 30s, 60s, 2m, 4m, 8m, then every 15 minutes.
  const delay = Math.min(30_000 * 2 ** (attempt - 1), 15 * 60_000);
  log(`reconnecting user ${userId} in ${Math.round(delay / 1000)}s (attempt ${attempt})`);

  const timer = setTimeout(() => {
    reconnectTimers.delete(userId);
    if (clients.has(userId)) return; // already back

    if (!hasStoredSession(userId)) {
      console.warn(`[wa] no stored session for user ${userId}; giving up, QR scan needed`);
      reconnectAttempts.delete(userId);
      return;
    }

    startClient(userId, { id: sessionId }).catch((err) => {
      console.error('[wa] reconnect failed:', err.message);
      scheduleReconnect(userId, sessionId);
    });
  }, delay);

  if (timer.unref) timer.unref();
  reconnectTimers.set(userId, timer);
}

/** True when LocalAuth has credentials on disk for this user. */
function hasStoredSession(userId) {
  return fs.existsSync(path.join(config.waSessionPath, `session-u-${userId}`));
}

/** True when the client is fully connected and can actually send. */
function isReady(entry) {
  return Boolean(entry && entry.client && entry.client.info && entry.client.info.wid);
}

function getEntry(userId) {
  return clients.get(userId) || null;
}

function statusFor(userId) {
  const entry = getEntry(userId);
  if (!entry) return { state: 'not_started', ready: false };
  return {
    state: isReady(entry) ? STATES.READY : entry.state,
    ready: isReady(entry),
    lastError: entry.lastError || null,
  };
}

async function startClient(userId, sessionRow) {
  const existing = clients.get(userId);
  if (existing) return existing;

  const entry = buildClient(userId, sessionRow.id);
  clients.set(userId, entry);

  entry.client.initialize().catch(async (err) => {
    console.error('[wa] initialize failed for user', userId, err.message);
    setState(entry, STATES.FAILED);
    entry.lastError = err.message;
    forgetEntry(userId, entry);
    await updateSession(sessionRow.id, { is_authenticated: false });

    // initialize() rejects asynchronously, long after startClient resolved, so
    // this is the only place a failed (re)connection attempt can be retried.
    // Without it the account stays dark until the process restarts.
    if (hasStoredSession(userId)) scheduleReconnect(userId, sessionRow.id);
  });

  return entry;
}

async function stopClient(userId, { wipeSession = false } = {}) {
  const entry = clients.get(userId);
  clients.delete(userId);

  // Cancel any pending auto-reconnect, otherwise a deliberate disconnect gets
  // undone thirty seconds later.
  const timer = reconnectTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(userId);
  }
  reconnectAttempts.delete(userId);

  if (entry) {
    if (wipeSession) {
      // logout() tells WhatsApp to unlink the device and clears LocalAuth's files.
      await entry.client.logout().catch(() => {});
    }
    await entry.client.destroy().catch(() => {});
  }

  if (wipeSession) {
    const dir = path.join(config.waSessionPath, `session-u-${userId}`);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      console.warn('[wa] could not remove session directory:', err.message);
    }
  }
}

/** Tear down and start again -- used when a QR code never appears. */
async function restartClient(userId, sessionRow) {
  await stopClient(userId);
  return startClient(userId, sessionRow);
}

/**
 * Bring previously-linked accounts back online at boot.
 *
 * Without this the scheduler would wake up with an empty client map, decide that
 * nobody's WhatsApp was connected, and mark every due reminder as permanently
 * failed -- which is exactly what the old version did on every redeploy.
 */
async function rehydrateSessions() {
  // Deliberately NOT filtered on is_authenticated. That flag goes false the
  // moment the user's phone drops off wifi, and a restart in that window used to
  // skip the account entirely -- leaving it dark forever. The credentials on
  // disk are the real source of truth about whether we can reconnect.
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('id, user_id, account_name, is_authenticated');

  if (error) {
    console.error('[wa] could not load sessions to rehydrate:', error.message);
    return 0;
  }
  if (!data || !data.length) {
    log('no previously linked accounts to restore');
    return 0;
  }

  let restored = 0;
  for (const row of data) {
    try {
      if (!hasStoredSession(row.user_id)) {
        if (row.is_authenticated) {
          // The row says "linked" but the session files are gone -- typically a
          // redeploy without a persistent volume. Tell the truth in the UI.
          console.warn(
            `[wa] no stored session on disk for user ${row.user_id}; QR scan needed again`
          );
          await updateSession(row.id, { is_authenticated: false, qr_code: null });
        }
        continue;
      }
      await startClient(row.user_id, row);
      restored += 1;
    } catch (err) {
      // One unusable row must never stop the other accounts from coming back.
      console.error(`[wa] could not restore session for user ${row.user_id}:`, err.message);
    }
  }

  log(`restoring ${restored} linked account(s) from ${config.waSessionPath}`);
  return restored;
}

/**
 * Send one message.
 * @returns {Promise<{ok: true, id: string} | {ok: false, error: string, permanent: boolean}>}
 */
async function sendMessage(userId, phone, body) {
  const entry = getEntry(userId);
  if (!isReady(entry)) {
    return { ok: false, error: 'WhatsApp is not connected for this account', permanent: false };
  }

  try {
    // Sending to a number that has no WhatsApp account throws a confusing
    // internal error, so check first and report something a human can act on.
    let chatId = toWhatsAppId(phone);
    try {
      const numberId = await withTimeout(entry.client.getNumberId(phone), 30_000, 'Number lookup');
      if (!numberId) {
        return {
          ok: false,
          error: 'This number is not registered on WhatsApp',
          permanent: true,
        };
      }
      chatId = numberId._serialized || chatId;
    } catch (err) {
      // A lookup failure is usually a connection problem rather than a bad
      // number, so carry on and let the send itself decide -- unless the
      // browser has died, in which case the send cannot work either.
      if (isTransientBrowserError(err.message)) throw err;
      console.warn('[wa] number lookup failed, sending anyway:', err.message);
    }

    const sent = await withTimeout(entry.client.sendMessage(chatId, body), 60_000, 'Send');
    return { ok: true, id: sent && sent.id ? sent.id._serialized : null };
  } catch (err) {
    const message = String((err && err.message) || err);

    if (isTransientBrowserError(message)) {
      // The headless browser crashed or navigated out from under us. The number
      // and the message are fine; the session needs rebuilding. Do that in the
      // background and tell the caller to come back shortly -- the scheduler
      // retries on its next tick anyway.
      console.error(`[wa] browser session lost while sending for user ${userId}: ${message}`);
      recoverSession(userId);
      return {
        ok: false,
        permanent: false,
        error: 'The WhatsApp connection dropped mid-send and is restarting. Try again in a minute.',
      };
    }

    const permanent = /invalid.*(number|wid)|not.*registered/i.test(message);
    return { ok: false, error: message.slice(0, 500), permanent };
  }
}

/**
 * Rebuild a broken session without blocking whoever hit the error.
 *
 * Guarded so that a batch of failing sends triggers one restart, not twenty.
 */
const recovering = new Set();

function recoverSession(userId) {
  if (recovering.has(userId)) return;
  recovering.add(userId);

  const entry = getEntry(userId);
  const sessionId = entry ? entry.sessionId : null;

  (async () => {
    try {
      await stopClient(userId);
      if (sessionId && hasStoredSession(userId)) {
        log(`rebuilding session for user ${userId} after a browser crash`);
        await startClient(userId, { id: sessionId });
      }
    } catch (err) {
      console.error('[wa] session recovery failed:', err.message);
    } finally {
      recovering.delete(userId);
    }
  })();
}

async function shutdownAll() {
  const ids = [...clients.keys()];
  await Promise.all(ids.map((userId) => stopClient(userId)));
}

module.exports = {
  STATES,
  clients,
  getEntry,
  isReady,
  statusFor,
  hasStoredSession,
  isTransientBrowserError,
  withTimeout,
  startClient,
  stopClient,
  restartClient,
  rehydrateSessions,
  sendMessage,
  shutdownAll,
};
