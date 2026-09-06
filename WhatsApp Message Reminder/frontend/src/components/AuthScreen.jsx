import { useState } from 'react';
import api, { setToken } from '../api.js';

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);

  const registering = mode === 'register';
  const forgetting = mode === 'forgot';

  function go(next) {
    setMode(next);
    setError('');
    setSent('');
    setPassword('');
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSent('');

    if (registering && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setBusy(true);
    try {
      if (forgetting) {
        const res = await api('/auth/forgot-password', { method: 'POST', body: { email } });
        setSent(res.message || 'If that email has an account, a reset link is on its way.');
      } else {
        const path = registering ? '/auth/register' : '/auth/login';
        const data = await api(path, { method: 'POST', body: { email, password } });
        setToken(data.token);
        onAuthed(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const heading = forgetting
    ? 'Reset your password'
    : registering
      ? 'Create an account'
      : 'Sign in to your account';

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>WhatsApp Reminders</h1>
        <p className="muted">{heading}</p>

        {forgetting && (
          <p className="muted small">
            Enter the email you sign in with. We&rsquo;ll send you a link to set a new password.
            It works once and expires in an hour.
          </p>
        )}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />

        {!forgetting && (
          <>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={registering ? 8 : undefined}
              autoComplete={registering ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={registering ? 'At least 8 characters' : 'Your password'}
            />
          </>
        )}

        {error && <p className="error">{error}</p>}
        {sent && (
          <div className="check">
            <span className="tag">Check your email</span>
            <p>{sent}</p>
            <p className="muted small">
              Nothing after a few minutes? Look in spam, or ask whoever set this up to run the
              reset command on the server.
            </p>
          </div>
        )}

        <button className="btn primary block" disabled={busy}>
          {busy
            ? 'Please wait...'
            : forgetting
              ? 'Send reset link'
              : registering
                ? 'Create account'
                : 'Sign in'}
        </button>

        {mode === 'login' && (
          <>
            <button type="button" className="btn ghost block" onClick={() => go('register')}>
              Need an account? Register
            </button>
            <button type="button" className="link-btn" onClick={() => go('forgot')}>
              Forgot your password?
            </button>
          </>
        )}

        {mode === 'register' && (
          <button type="button" className="btn ghost block" onClick={() => go('login')}>
            Have an account? Sign in
          </button>
        )}

        {forgetting && (
          <button type="button" className="btn ghost block" onClick={() => go('login')}>
            Back to sign in
          </button>
        )}
      </form>
    </div>
  );
}
