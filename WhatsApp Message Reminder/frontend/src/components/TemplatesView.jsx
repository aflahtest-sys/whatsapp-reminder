import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api.js';
import { Empty, useConfirm } from './ui.jsx';

const FALLBACK_PLACEHOLDERS = [
  { key: 'name', description: "The customer's name" },
  { key: 'phone', description: "The customer's phone number" },
  { key: 'date', description: "Today's date" },
  { key: 'time', description: 'The time the message is sent' },
  { key: 'day', description: 'The day of the week' },
];

const SAMPLE = {
  name: 'Khalid',
  phone: '+968 91234567',
  date: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
  time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }),
  day: new Date().toLocaleDateString(undefined, { weekday: 'long' }),
};

const TOKEN_RE = /\{\{?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}?\}/g;

function renderPreview(body, values) {
  TOKEN_RE.lastIndex = 0;
  return String(body || '').replace(TOKEN_RE, (whole, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : whole
  );
}

function findUnknown(body, known) {
  const out = [];
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(String(body || ''))) !== null) {
    if (!known.includes(m[1]) && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

export default function TemplatesView({ notify }) {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [placeholders, setPlaceholders] = useState(FALLBACK_PLACEHOLDERS);
  const bodyRef = useRef(null);
  const { ask, dialog } = useConfirm();

  async function load() {
    try {
      const d = await api('/messages');
      setTemplates(d.templates || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
    api('/messages/placeholders')
      .then((d) => d.placeholders?.length && setPlaceholders(d.placeholders))
      .catch(() => {
        /* the fallback list is fine */
      });
  }, []);

  const known = useMemo(() => placeholders.map((p) => p.key), [placeholders]);
  const unknown = useMemo(() => findUnknown(body, known), [body, known]);
  const preview = useMemo(() => renderPreview(body, SAMPLE), [body]);

  function reset() {
    setName('');
    setBody('');
    setEditingId(null);
    setError('');
  }

  /** Insert a placeholder at the cursor rather than making people type braces. */
  function insert(key) {
    const el = bodyRef.current;
    const token = `{${key}}`;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = { name, body };
      if (editingId) {
        await api(`/messages/${editingId}`, { method: 'PUT', body: payload });
        notify('Template updated.', 'success');
      } else {
        await api('/messages', { method: 'POST', body: payload });
        notify('Template created.', 'success');
      }
      reset();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(t) {
    setEditingId(t.id);
    setName(t.name);
    setBody(t.body);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function confirmRemove(template) {
    ask({
      title: `Delete "${template.name}"?`,
      message:
        'Any active schedule using this template will be cancelled. Delivery history is kept. This cannot be undone.',
      confirmLabel: 'Delete template',
      onConfirm: async () => {
        try {
          const res = await api(`/messages/${template.id}`, { method: 'DELETE' });
          notify(
            res.cancelled_schedules
              ? `Template deleted, along with ${res.cancelled_schedules} schedule(s).`
              : 'Template deleted.',
            'info'
          );
          if (editingId === template.id) reset();
          await load();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  return (
    <section>
      {dialog}
      <h2>Message templates</h2>

      <form className="card" onSubmit={submit}>
        <label htmlFor="tpl-name">Template name</label>
        <input
          id="tpl-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Drone service reminder"
          required
        />

        <label htmlFor="tpl-body">Message</label>
        <textarea
          id="tpl-body"
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Hi {name}, your drone is due for a battery check. Reply to book a slot."
          required
        />

        <div className="chip-row">
          <span className="muted">Insert:</span>
          {placeholders.map((p) => (
            <button
              type="button"
              key={p.key}
              className="chip ghost"
              title={p.description}
              onClick={() => insert(p.key)}
            >
              {'{'}
              {p.key}
              {'}'}
            </button>
          ))}
        </div>

        {unknown.length > 0 && (
          <p className="error">
            Unknown placeholder{unknown.length > 1 ? 's' : ''}{' '}
            {unknown.map((u) => `{${u}}`).join(', ')} — the customer would receive that text
            literally. Use one of the buttons above.
          </p>
        )}

        {body.trim() && (
          <div className="preview">
            <span className="preview-label">Preview</span>
            <div className="bubble">{preview}</div>
            <p className="muted small">
              Shown with sample details. Each customer gets their own name and number.
            </p>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className="row">
          <button className="btn primary" disabled={busy || unknown.length > 0}>
            {editingId ? 'Save changes' : 'Create template'}
          </button>
          {editingId && (
            <button type="button" className="btn ghost" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Message</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="prewrap">{t.body}</td>
                <td className="actions">
                  <button className="btn ghost sm" onClick={() => startEdit(t)}>
                    Edit
                  </button>
                  <button className="btn danger sm" onClick={() => confirmRemove(t)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {loaded && !templates.length && (
              <Empty colSpan={3}>No templates yet. Create one above.</Empty>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
