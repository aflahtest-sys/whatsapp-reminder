import { useEffect, useState } from 'react';
import api, { setToken, getToken, onSignedOut } from './api.js';

import AuthScreen from './components/AuthScreen.jsx';
import WhatsAppView from './components/WhatsAppView.jsx';
import CustomersView from './components/CustomersView.jsx';
import TemplatesView from './components/TemplatesView.jsx';
import SchedulesView from './components/SchedulesView.jsx';
import LogsView from './components/LogsView.jsx';
import { Toast, useToast } from './components/ui.jsx';

const TABS = [
  ['whatsapp', 'WhatsApp'],
  ['customers', 'Customers'],
  ['templates', 'Templates'],
  ['schedules', 'Reminders'],
  ['logs', 'Delivery log'],
];

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('whatsapp');
  const [checking, setChecking] = useState(true);
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

  // If any request comes back 401 the token is dead; drop straight to the login
  // screen instead of leaving the user staring at errors on every tab.
  useEffect(() => onSignedOut(() => setUser(null)), []);

  function logout() {
    setToken(null);
    setUser(null);
    setView('whatsapp');
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
      </main>

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
