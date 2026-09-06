import { useCallback, useEffect, useState } from 'react';
import api from '../api.js';
import { phoneHint } from '../lib/phone.js';
import { formatDateTime } from '../lib/schedule.js';

const STATE_TEXT = {
  not_started: 'Not linked yet.',
  starting: 'Starting up the connection...',
  awaiting_qr_scan: 'Scan the QR code below with your phone.',
  authenticated: 'Signed in, finishing sync...',
  ready: 'Connected. Reminders will be sent from this account.',
  disconnected: 'Disconnected. Link again to keep sending.',
  failed: 'The connection failed. Try linking again.',
};

export default function WhatsAppView({ notify }) {
  const [sessions, setSessions] = useState([]);
  const [name, setName] = useState('');
  // Two separate slots on purpose. The status poll runs every four seconds, and
  // when it shared one slot with button errors it wiped the explanation for a
  // failed click before the user could read it.
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async (signal) => {
    try {
      const d = await api('/whatsapp/status', { signal });
      setSessions(d.sessions || []);
      setPollError('');
    } catch (err) {
      if (err.name !== 'AbortError') setPollError(err.message);
    } finally {
      setLoaded(true);
    }
  }, []);

  const connected = sessions.some((s) => s.is_authenticated);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);

    // Poll quickly while waiting for a QR scan, slowly once connected -- the old
    // version hammered the API every four seconds forever.
    const interval = connected ? 30_000 : 4000;
    const timer = setInterval(() => refresh(controller.signal), interval);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refresh, connected]);

  async function link(restart = false) {
    setBusy(true);
    setError('');
    try {
      await api('/whatsapp/link', {
        method: 'POST',
        body: { account_name: name || undefined, restart },
      });
      setName('');
      await refresh();
      if (restart) notify('Restarted. A new QR code should appear shortly.', 'info');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(id) {
    setBusy(true);
    setError('');
    try {
      await api('/whatsapp/disconnect', { method: 'POST', body: { session_id: id } });
      notify('WhatsApp account unlinked.', 'info');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>WhatsApp account</h2>
      <p className="muted">
        Link your WhatsApp once, then reminders send themselves. On your phone open
        WhatsApp &gt; Settings &gt; Linked devices &gt; Link a device, and scan the code below.
      </p>

      <div className="callout warn">
        <strong>Keep your account safe.</strong> This app drives WhatsApp Web, which is not an
        official messaging channel. Send only to clients who expect to hear from you, keep the
        volume reasonable, and always give people a way to opt out. Accounts that send unwanted
        bulk messages get banned.
      </div>

      {/* Shown whenever the account is not connected -- not only on a first
          run. Hiding this once a session row existed meant that after WhatsApp
          was unlinked from the phone, the only way back was a small "Restart"
          button, which does not read as "link my account again". */}
      {!connected && loaded && (
        <div className="card">
          {sessions.length > 0 && (
            <p className="muted">
              This account is not connected. Link it again to start sending.
            </p>
          )}
          <div className="row">
            {!sessions.length && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Account name (optional, e.g. IFDC Service)"
              />
            )}
            <button
              className="btn primary"
              onClick={() => link(sessions.length > 0)}
              disabled={busy}
            >
              {busy ? 'Linking...' : 'Link WhatsApp account'}
            </button>
          </div>
          <p className="muted small">
            A QR code takes up to a minute to appear. Clicking again starts another
            browser and makes it slower, so give it time.
          </p>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {sessions.map((s) => (
        <div className="card" key={s.id}>
          <div className="row between">
            <div>
              <strong>{s.account_name || 'WhatsApp'}</strong>
              <p className="muted">
                <span className={`dot ${s.is_authenticated ? 'on' : 'off'}`} />
                {STATE_TEXT[s.state] || STATE_TEXT.not_started}
              </p>
              {s.last_ready_at && (
                <p className="muted small">Last connected {formatDateTime(s.last_ready_at)}</p>
              )}
              {s.last_error && <p className="error small">{s.last_error}</p>}
            </div>
            <div className="row">
              {!s.is_authenticated && (
                <button className="btn ghost" onClick={() => link(true)} disabled={busy}>
                  {busy ? 'Working...' : 'Restart'}
                </button>
              )}
              {s.is_authenticated && (
                <button className="btn danger" onClick={() => disconnect(s.id)} disabled={busy}>
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {!s.is_authenticated && s.qr_code && (
            <div className="qr-box">
              <img src={s.qr_code} alt="WhatsApp QR code" />
              <p className="muted">
                Scan this with your phone. The code refreshes automatically every few seconds.
              </p>
            </div>
          )}
          {!s.is_authenticated && !s.qr_code && (
            <p className="muted">
              Generating QR code... this takes about 20 seconds the first time. If nothing appears,
              press Restart.
            </p>
          )}
        </div>
      ))}

      {error && sessions.length > 0 && <p className="error">{error}</p>}
      {pollError && <p className="muted small">Could not refresh status: {pollError}</p>}

      {/* Always mounted. Unmounting on a momentary `ready: false` threw away
          whatever the user had typed into it. */}
      {sessions.length > 0 && <TestMessage notify={notify} connected={connected} />}
    </section>
  );
}

/**
 * Sending one test message is the fastest way to confirm the link really works
 * before trusting it with a whole client list.
 */
function TestMessage({ notify, connected }) {
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('Test message from WhatsApp Reminders.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const hint = phoneHint(phone);

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api('/whatsapp/test', { method: 'POST', body: { phone, body } });
      notify(`Test message sent to ${res.to}.`, 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={send}>
      <h3>Send a test message</h3>
      <p className="muted">Try your own number first, before scheduling anything for clients.</p>
      <div className="row">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+968 91234567"
          required
        />
        <button className="btn ghost" disabled={busy || !connected}>
          {busy ? 'Sending...' : 'Send test'}
        </button>
      </div>
      {!connected && (
        <p className="muted small">Link your WhatsApp account first to send a test.</p>
      )}
      <label htmlFor="test-body">Message</label>
      <textarea
        id="test-body"
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {hint && <p className="muted small">{hint}</p>}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
