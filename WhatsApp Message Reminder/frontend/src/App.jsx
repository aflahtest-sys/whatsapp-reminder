import { useEffect, useState } from 'react';
import api, { setToken, getToken, onSignedOut } from './api.js';

import AuthScreen from './components/AuthScreen.jsx';
import ResetPasswordScreen from './components/ResetPasswordScreen.jsx';
import WhatsAppView from './components/WhatsAppView.jsx';
import CustomersView from './components/CustomersView.jsx';
import TemplatesView from './components/TemplatesView.jsx';
import SchedulesView from './components/SchedulesView.jsx';
import LogsView from './components/LogsView.jsx';
import AccountView from './components/AccountView.jsx';
import { Toast, useToast } from './components/ui.jsx';

const TABS = [
  ['whatsapp', 'WhatsApp'],
  ['customers', 'Customers'],
  ['templates', 'Templates'],
  ['schedules', 'Reminders'],
  ['logs', 'Delivery log'],
  ['account', 'Account'],
];

/** A reset link puts the token in the query string; there is no router here. */
function readResetToken() {
  try {
    return new URLSearchParams(window.location.search).get('token') || '';
  } catch {
    return '';
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('whatsapp');
  const [checking, setChecking] = useState(true);
  const [resetToken, setResetToken] = useState(readResetToken);
  const { toast, notify, dismiss } = useToast();

  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return undefined;
    }
    let cancelled = false;
    api('/auth/me')
      .then((d) => !cancelled && setUser(d.user))
      .catch(() => {
        setToken(null);
        if (!cancelled) setUser(null);
      })
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Any 401 means the token is dead -- expired, or retired by a password
  // change on another device. Drop to the sign-in screen rather than leaving
  // the user staring at errors on every tab.
  useEffect(() => onSignedOut(() => setUser(null)), []);

  function logout() {
    setToken(null);
    setUser(null);
    setView('whatsapp');
  }

  // Someone arriving on a reset link should land on the reset form even if an
  // old session is still stored in this browser -- forgetting the password is
  // the whole reason they clicked it.
  if (resetToken) {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onFinished={() => {
          setToken(null);
          setUser(null);
          setResetToken('');
        }}
      />
    );
  }

  if (checking) return <div className="center-screen">Loading...</div>;
  if (!user) return <AuthScreen onAuthed={setUser} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">WhatsApp Reminders</div>
        <nav className="nav">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`nav-btn ${view === key ? 'active' : ''}`}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="user-box">
          <span className="muted">{user.email}</span>
          <button className="btn ghost sm" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        {view === 'whatsapp' && <WhatsAppView notify={notify} />}
        {view === 'customers' && <CustomersView notify={notify} />}
        {view === 'templates' && <TemplatesView notify={notify} />}
        {view === 'schedules' && <SchedulesView notify={notify} />}
        {view === 'logs' && <LogsView notify={notify} />}
        {view === 'account' && <AccountView user={user} notify={notify} />}
      </main>

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
