import { useMemo, useState } from 'react';
import api from '../api.js';

/**
 * Shown when the browser arrives carrying a reset token in the URL.
 *
 * The token stays in the address bar only until the password is set, then the
 * URL is cleaned so it is not left sitting in browser history for the next
 * person who uses the machine.
 */
export default function ResetPasswordScreen({ token, onFinished }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const problem = useMemo(() => {
    if (!password) return null;
    if (password.length < 8) return 'At least 8 characters.';
    if (confirm && password !== confirm) return 'The two passwords do not match.';
    return null;
  }, [password, confirm]);

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('The two passwords do not match');

    setBusy(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      setDone(true);
      // Strip the token out of the address bar and the history entry.
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>Password updated</h1>
          <div className="check">
            <span className="tag">Done</span>
            <p>You can sign in with your new password now.</p>
          </div>
          <p className="muted small">
            Anywhere else you were signed in has been signed out.
          </p>
          <button className="btn primary block" onClick={onFinished}>
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Set a new password</h1>
        <p className="muted">Choose something you haven&rsquo;t used here before.</p>

        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />

        <label htmlFor="confirm-password">Type it again</label>
        <input
          id="confirm-password"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {problem && <p className="muted small">{problem}</p>}
        {error && (
          <>
            <p className="error">{error}</p>
            {/expired|already been used|already used/i.test(error) && (
              <button type="button" className="btn ghost block" onClick={onFinished}>
                Request a new link
              </button>
            )}
          </>
        )}

        <button className="btn primary block" disabled={busy || Boolean(problem) || !password}>
          {busy ? 'Saving...' : 'Save new password'}
        </button>
      </form>
    </div>
  );
}
