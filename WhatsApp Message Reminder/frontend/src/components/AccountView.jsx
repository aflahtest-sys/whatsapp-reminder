import { useState } from 'react';
import api, { setToken } from '../api.js';

export default function AccountView({ user, notify }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function clear() {
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (next.length < 8) return setError('New password must be at least 8 characters');
    if (next !== confirm) return setError('The two new passwords do not match');
    if (next === current) return setError('That is the same as your current password');

    setBusy(true);
    try {
      const res = await api('/auth/change-password', {
        method: 'POST',
        body: { current_password: current, new_password: next },
      });
      // The server issues a fresh token so this tab stays signed in. Without
      // swapping it, changing your password would immediately log you out of
      // the page you changed it on.
      if (res.token) setToken(res.token);
      clear();
      notify(res.message || 'Password changed.', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Your account</h2>

      <div className="card">
        <div className="field">
          <span className="label">Signed in as</span>
          <span className="value">{user.email}</span>
        </div>
        <p className="muted small">
          Accounts are created from the sign-in screen. To add someone at IFDC, send them the
          site address and have them register, then they&rsquo;ll have their own separate customer
          list.
        </p>
      </div>

      <form className="card" onSubmit={submit}>
        <h3>Change your password</h3>
        <p className="muted small">
          Changing it signs you out on every other device. This tab stays signed in.
        </p>

        <label htmlFor="cur-pw">Current password</label>
        <input
          id="cur-pw"
          type="password"
          required
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />

        <div className="grid2">
          <div>
            <label htmlFor="new-pw">New password</label>
            <input
              id="new-pw"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label htmlFor="new-pw2">Type it again</label>
            <input
              id="new-pw2"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="row">
          <button className="btn primary" disabled={busy}>
            {busy ? 'Saving...' : 'Change password'}
          </button>
          {(current || next || confirm) && (
            <button type="button" className="btn ghost" onClick={clear}>
              Clear
            </button>
          )}
        </div>
      </form>

      <div className="callout">
        <strong>Forgotten it entirely?</strong> Sign out, then use
        &ldquo;Forgot your password?&rdquo; on the sign-in screen. If the email never arrives,
        whoever runs the server can reset any account with{' '}
        <code>node scripts/set-password.js your@email.com</code> in the backend folder.
      </div>
    </section>
  );
}
