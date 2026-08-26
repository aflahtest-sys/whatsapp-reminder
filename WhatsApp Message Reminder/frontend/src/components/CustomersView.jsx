import { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import { formatPhone, phoneHint } from '../lib/phone.js';
import { TagInput, Empty, useConfirm } from './ui.jsx';

const BLANK = { name: '', phone: '', tags: [] };

export default function CustomersView({ notify }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { ask, dialog } = useConfirm();

  async function load() {
    try {
      const d = await api('/customers');
      setCustomers(d.customers || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const allTags = useMemo(() => {
    const set = new Set();
    customers.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [customers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    // Only compare digits when the query actually contains some. Otherwise
    // `phone.includes('')` is true for every row and the search does nothing.
    const digits = q.replace(/\D/g, '');
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (digits && c.phone.includes(digits)) ||
        (c.tags || []).some((t) => t.includes(q))
    );
  }, [customers, search]);

  function reset() {
    setForm(BLANK);
    setEditingId(null);
    setError('');
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = { name: form.name, phone: form.phone, tags: form.tags };
      if (editingId) {
        await api(`/customers/${editingId}`, { method: 'PUT', body });
        notify('Customer updated.', 'success');
      } else {
        const res = await api('/customers', { method: 'POST', body });
        notify(
          res.assumedCountry
            ? `Added ${form.name} as ${formatPhone(res.customer.phone)} — no country code was given, so the default was used.`
            : `Added ${form.name}.`,
          res.assumedCountry ? 'info' : 'success'
        );
      }
      reset();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(c) {
    setEditingId(c.id);
    setForm({ name: c.name, phone: formatPhone(c.phone), tags: c.tags || [] });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function confirmRemove(customer) {
    ask({
      title: `Delete ${customer.name}?`,
      message:
        'This also deletes any scheduled reminders for this customer. Delivery history is kept. This cannot be undone.',
      confirmLabel: 'Delete customer',
      onConfirm: async () => {
        try {
          await api(`/customers/${customer.id}`, { method: 'DELETE' });
          notify(`${customer.name} deleted.`, 'info');
          if (editingId === customer.id) reset();
          await load();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  const hint = phoneHint(form.phone);

  return (
    <section>
      {dialog}
      <div className="row between section-head">
        <h2>Customers</h2>
        <span className="muted">{customers.length} total</span>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="grid2">
          <div>
            <label htmlFor="cust-name">Name</label>
            <input
              id="cust-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Khalid Al Balushi"
              required
            />
          </div>
          <div>
            <label htmlFor="cust-phone">Phone</label>
            <input
              id="cust-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+968 91234567"
              required
            />
          </div>
        </div>

        <label>Groups</label>
        <p className="muted small">
          Tag customers so one schedule can reach all of them at once — for example
          &ldquo;service-due&rdquo; or &ldquo;vip&rdquo;.
        </p>
        <TagInput
          value={form.tags}
          onChange={(tags) => setForm({ ...form, tags })}
          suggestions={allTags}
        />

        {hint && <p className="muted small">{hint}</p>}
        {error && <p className="error">{error}</p>}

        <div className="row">
          <button className="btn primary" disabled={busy}>
            {editingId ? 'Save changes' : 'Add customer'}
          </button>
          {editingId && (
            <button type="button" className="btn ghost" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {(customers.length > 5 || search) && (
        <input
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, number or group..."
        />
      )}

      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Groups</th>
              <th>Added</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="mono">{formatPhone(c.phone)}</td>
                <td>
                  {(c.tags || []).length ? (
                    <div className="chip-row">
                      {c.tags.map((t) => (
                        <span className="chip static" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="actions">
                  <button className="btn ghost sm" onClick={() => startEdit(c)}>
                    Edit
                  </button>
                  <button className="btn danger sm" onClick={() => confirmRemove(c)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {loaded && !visible.length && (
              <Empty colSpan={5}>
                {search
                  ? 'No customers match that search.'
                  : 'No customers yet. Add your first one above.'}
              </Empty>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
