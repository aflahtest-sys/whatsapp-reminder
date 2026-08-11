import { useEffect, useState } from 'react';
import api, { setToken, getToken } from './api.js';

const SEND_TYPES = [
  { value: 'immediate', label: 'Send now' },
  { value: 'once', label: 'One-time at a date/time' },
  { value: 'daily', label: 'Daily at a time' },
  { value: 'weekly', label: 'Weekly at a time' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('whatsapp');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return;
    }
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setChecking(false));
  }, []);

  function logout() {
    setToken(null);
    setUser(null);
  }

  if (checking) return <div className="center-screen">Loading...</div>;

  if (!user) return <AuthScreen onAuthed={(u) => setUser(u)} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">WhatsApp Reminders</div>
        <nav className="nav">
          {[
            ['whatsapp', 'WhatsApp'],
            ['customers', 'Customers'],
            ['templates', 'Templates'],
            ['schedules', 'Scheduled Sends'],
            ['logs', 'Status Log'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`nav-btn ${view === key ? 'active' : ''}`}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="user-box">
          <span>{user.email}</span>
          <button className="btn ghost" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="content">
        {view === 'whatsapp' && <WhatsAppView />}
        {view === 'customers' && <CustomersView />}
        {view === 'templates' && <TemplatesView />}
        {view === 'schedules' && <SchedulesView />}
        {view === 'logs' && <LogsView />}
      </main>
    </div>
  );
}

/* ------------------------------- auth ------------------------------- */

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const data = await api(path, { method: 'POST', body: { email, password } });
      setToken(data.token);
      onAuthed(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>WhatsApp Reminders</h1>
        <p className="muted">
          {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
        </p>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@drone-shop.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="btn ghost block" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}

/* ----------------------------- whatsapp ----------------------------- */

function WhatsAppView() {
  const [sessions, setSessions] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const d = await api('/whatsapp/status');
      setSessions(d.sessions || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  async function link() {
    setBusy(true);
    setError('');
    try {
      await api('/whatsapp/link', { method: 'POST', body: { account_name: name || 'WhatsApp' } });
      setName('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(id) {
    await api('/whatsapp/disconnect', { method: 'POST', body: { session_id: id } });
    refresh();
  }

  return (
    <section>
      <h2>WhatsApp account</h2>
      <p className="muted">
        Link your WhatsApp account once. The QR code shown below is scanned from your phone:
        WhatsApp &gt; Settings &gt; Linked devices &gt; Link a device.
      </p>

      <div className="card">
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name (optional)" />
          <button className="btn primary" onClick={link} disabled={busy}>
            {busy ? 'Linking...' : 'Link WhatsApp account'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {sessions.map((s) => (
        <div className="card" key={s.id}>
          <div className="row between">
            <div>
              <strong>{s.account_name || 'WhatsApp'}</strong>
              <p className="muted">
                {s.is_authenticated
                  ? 'Connected - messages will be sent from this account.'
                  : 'Waiting for QR scan...'}
              </p>
            </div>
            {s.is_authenticated && (
              <button className="btn danger" onClick={() => disconnect(s.id)}>Disconnect</button>
            )}
          </div>
          {!s.is_authenticated && s.qr_code && (
            <div className="qr-box">
              <img src={s.qr_code} alt="WhatsApp QR code" />
              <p className="muted">Scan this with your phone. The code refreshes every ~20 seconds.</p>
            </div>
          )}
          {!s.is_authenticated && !s.qr_code && (
            <p className="muted">Generating QR code...</p>
          )}
        </div>
      ))}
    </section>
  );
}

/* ----------------------------- customers ---------------------------- */

function CustomersView() {
  const [customers, setCustomers] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const d = await api('/customers');
      setCustomers(d.customers || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await api(`/customers/${editingId}`, { method: 'PUT', body: { name, phone } });
      } else {
        await api('/customers', { method: 'POST', body: { name, phone } });
      }
      setName('');
      setPhone('');
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(c) {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone);
  }

  async function remove(id) {
    await api(`/customers/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <section>
      <h2>Customers</h2>
      <form className="card" onSubmit={submit}>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. John, drone #A4)" required />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone with country code (e.g. +15551234567)" required />
          <button className="btn primary">{editingId ? 'Save changes' : 'Add customer'}</button>
          {editingId && (
            <button type="button" className="btn ghost" onClick={() => { setEditingId(null); setName(''); setPhone(''); }}>
              Cancel
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </form>

      <div className="table-wrap card">
        <table>
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Added</th><th></th></tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.phone}</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="actions">
                  <button className="btn ghost sm" onClick={() => startEdit(c)}>Edit</button>
                  <button className="btn danger sm" onClick={() => remove(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan="4" className="muted">No customers yet. Add your first customer above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------ templates --------------------------- */

function TemplatesView() {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const d = await api('/messages');
      setTemplates(d.templates || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await api(`/messages/${editingId}`, { method: 'PUT', body: { name, body } });
      } else {
        await api('/messages', { method: 'POST', body: { name, body } });
      }
      setName('');
      setBody('');
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(t) {
    setEditingId(t.id);
    setName(t.name);
    setBody(t.body);
  }

  async function remove(id) {
    await api(`/messages/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <section>
      <h2>Message templates</h2>
      <form className="card" onSubmit={submit}>
        <label>
          Template name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Drone service reminder" required />
        </label>
        <label>
          Message body
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Hi {name}, your drone is due for a battery check. Reply to book a slot." required />
        </label>
        <div className="row">
          <button className="btn primary">{editingId ? 'Save changes' : 'Create template'}</button>
          {editingId && (
            <button type="button" className="btn ghost" onClick={() => { setEditingId(null); setName(''); setBody(''); }}>
              Cancel
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </form>

      <div className="table-wrap card">
        <table>
          <thead>
            <tr><th>Name</th><th>Body</th><th></th></tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="prewrap">{t.body}</td>
                <td className="actions">
                  <button className="btn ghost sm" onClick={() => startEdit(t)}>Edit</button>
                  <button className="btn danger sm" onClick={() => remove(t.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr><td colSpan="3" className="muted">No templates yet. Create one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------ schedules --------------------------- */

function nextOccurrence(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function SchedulesView() {
  const [customers, setCustomers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [sendType, setSendType] = useState('immediate');
  const [onceAt, setOnceAt] = useState('');
  const [dailyTime, setDailyTime] = useState('09:00');
  const [error, setError] = useState('');

  async function loadAll() {
    try {
      const [c, t, s] = await Promise.all([api('/customers'), api('/messages'), api('/schedules')]);
      setCustomers(c.customers || []);
      setTemplates(t.templates || []);
      setSchedules(s.schedules || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!customerId) return setError('Select a customer');
    if (!templateId) return setError('Select a template');

    let schedule_time = null;
    if (sendType === 'once') {
      if (!onceAt) return setError('Pick a date and time');
      schedule_time = new Date(onceAt).toISOString();
    } else if (sendType !== 'immediate') {
      schedule_time = nextOccurrence(dailyTime);
    }

    try {
      await api('/schedules', {
        method: 'POST',
        body: { customer_id: customerId, template_id: templateId, send_type: sendType, schedule_time },
      });
      setCustomerId('');
      setTemplateId('');
      setSendType('immediate');
      setOnceAt('');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancel(id) {
    await api(`/schedules/${id}/cancel`, { method: 'POST' });
    loadAll();
  }

  const customerName = (id) => (customers.find((c) => c.id === id) || {}).name || 'Unknown';
  const templateName = (id) => (templates.find((t) => t.id === id) || {}).name || 'Unknown';

  return (
    <section>
      <h2>Schedule a send</h2>
      <form className="card" onSubmit={submit}>
        <div className="grid2">
          <label>
            Customer
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
            </select>
          </label>
          <label>
            Template
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Select template...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        </div>

        <div className="grid2">
          <div>
            <label>When</label>
            <div className="row wrap">
              {SEND_TYPES.map((t) => (
                <label key={t.value} className="radio">
                  <input type="radio" name="sendType" value={t.value}
                    checked={sendType === t.value}
                    onChange={() => setSendType(t.value)} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <label>
            {sendType === 'once'
              ? 'Date & time'
              : sendType === 'immediate'
                ? 'Send right away'
                : sendType === 'daily' ? 'Daily time' : 'Weekly time (every 7 days)'}
            {sendType === 'once' && (
              <input type="datetime-local" value={onceAt} onChange={(e) => setOnceAt(e.target.value)} />
            )}
            {(sendType === 'daily' || sendType === 'weekly') && (
              <input type="time" value={dailyTime} onChange={(e) => setDailyTime(e.target.value)} />
            )}
          </label>
        </div>

        {error && <p className="error">{error}</p>}
        <button className="btn primary">Schedule</button>
      </form>

      <div className="table-wrap card">
        <table>
          <thead>
            <tr><th>Customer</th><th>Template</th><th>Type</th><th>Next run</th><th>Last sent</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id}>
                <td>{customerName(s.customer_id)}</td>
                <td>{templateName(s.template_id)}</td>
                <td>{s.send_type}</td>
                <td>{s.schedule_time ? new Date(s.schedule_time).toLocaleString() : '—'}</td>
                <td>{s.last_sent ? new Date(s.last_sent).toLocaleString() : '—'}</td>
                <td><span className={`badge ${s.status}`}>{s.status}</span></td>
                <td className="actions">
                  {s.status === 'active' && (
                    <button className="btn danger sm" onClick={() => cancel(s.id)}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr><td colSpan="7" className="muted">No scheduled sends yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* -------------------------------- logs ------------------------------ */

function LogsView() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/logs')
      .then((d) => setLogs(d.logs || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section>
      <h2>Delivery status log</h2>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap card">
        <table>
          <thead>
            <tr><th>Customer</th><th>Message</th><th>Status</th><th>Sent at</th><th>Error</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.customers ? l.customers.name : '—'}</td>
                <td className="prewrap">{l.message_body || '—'}</td>
                <td><span className={`badge ${l.status}`}>{l.status}</span></td>
                <td>{new Date(l.sent_at).toLocaleString()}</td>
                <td className="muted">{l.error || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan="5" className="muted">No delivery attempts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
