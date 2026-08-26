import { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import {
  SEND_TYPES,
  TARGET_TYPES,
  WEEKDAYS,
  describeSchedule,
  firstOccurrence,
  formatDateTime,
  localInputNow,
  relativeTime,
} from '../lib/schedule.js';
import { Empty, useConfirm } from './ui.jsx';

const BLANK = {
  targetType: 'customer',
  customerId: '',
  tag: '',
  templateId: '',
  sendType: 'immediate',
  onceAt: '',
  timeOfDay: '09:00',
  weekday: 3,
};

export default function SchedulesView({ notify }) {
  const [customers, setCustomers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState(BLANK);
  // `error` is only ever form validation and submit failures, so a background
  // poll can neither erase a validation message nor leave a stale network error
  // sitting under the Schedule button forever. Load failures get their own slot.
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const { ask, dialog } = useConfirm();

  async function loadAll() {
    try {
      const [c, t, s] = await Promise.all([api('/customers'), api('/messages'), api('/schedules')]);
      setCustomers(c.customers || []);
      setTemplates(t.templates || []);
      setSchedules(s.schedules || []);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    loadAll();
    // Statuses change on the server every minute, so keep the table honest.
    const timer = setInterval(loadAll, 30_000);
    return () => clearInterval(timer);
  }, []);

  const tags = useMemo(() => {
    const counts = new Map();
    customers.forEach((c) => (c.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [customers]);

  const customerById = useMemo(
    () => Object.fromEntries(customers.map((c) => [c.id, c])),
    [customers]
  );
  const templateById = useMemo(
    () => Object.fromEntries(templates.map((t) => [t.id, t])),
    [templates]
  );

  const recipientCount = useMemo(() => {
    if (form.targetType === 'all') return customers.length;
    if (form.targetType === 'tag') {
      return form.tag ? customers.filter((c) => (c.tags || []).includes(form.tag)).length : 0;
    }
    return form.customerId ? 1 : 0;
  }, [form, customers]);

  // Show the exact moment the first message will go out, so nobody is surprised.
  const firstRun = useMemo(() => {
    if (form.sendType === 'immediate') return new Date();
    if (form.sendType === 'once') return form.onceAt ? new Date(form.onceAt) : null;
    return firstOccurrence(
      form.sendType,
      form.timeOfDay,
      form.sendType === 'weekly' ? form.weekday : null
    );
  }, [form]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function validate() {
    if (!form.templateId) return 'Choose a message template';
    if (form.targetType === 'customer' && !form.customerId) return 'Choose a customer';
    if (form.targetType === 'tag' && !form.tag) return 'Choose a group';
    if (!recipientCount) return 'That selection reaches nobody';
    if (form.sendType === 'once' && !form.onceAt) return 'Pick a date and time';
    if (form.sendType === 'once' && new Date(form.onceAt).getTime() <= Date.now()) {
      return 'Pick a time in the future';
    }
    return null;
  }

  function onSubmit(e) {
    e.preventDefault();

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');

    // A bulk send cannot be recalled once WhatsApp has it, so make the number of
    // real people about to be messaged impossible to miss. Only ask once the
    // form is known to be valid -- warning about 40 messages and then failing on
    // "Choose a template" is alarming and pointless.
    if (form.sendType === 'immediate' && recipientCount >= 2) {
      ask({
        title: `Send to ${recipientCount} people now?`,
        message: `This sends a WhatsApp message to ${recipientCount} people right away. It cannot be undone.`,
        confirmLabel: 'Send now',
        danger: false,
        onConfirm: send,
      });
      return;
    }
    send();
  }

  async function send() {
    const body = {
      template_id: form.templateId,
      send_type: form.sendType,
      target_type: form.targetType,
      customer_id: form.targetType === 'customer' ? form.customerId : null,
      target_tag: form.targetType === 'tag' ? form.tag : null,
      weekly_day: form.sendType === 'weekly' ? Number(form.weekday) : null,
      schedule_time:
        form.sendType === 'immediate' ? null : firstRun ? firstRun.toISOString() : null,
    };

    setBusy(true);
    try {
      await api('/schedules', { method: 'POST', body });
      notify(
        form.sendType === 'immediate'
          ? `Sending to ${recipientCount} recipient${recipientCount === 1 ? '' : 's'} now.`
          : `Scheduled for ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}.`,
        'success'
      );
      setForm({ ...BLANK, timeOfDay: form.timeOfDay });
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Row actions report through the toast, not the `error` slot: that slot renders
  // inside the form at the top of the page, so a failure on row 20 used to be
  // invisible and the button just looked broken.
  async function act(schedule, action, label) {
    if (acting) return;
    setActing(schedule.id);
    try {
      await api(`/schedules/${schedule.id}/${action}`, { method: 'POST' });
      notify(label, 'info');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
      await loadAll(); // the row is probably out of date; show its real state
    } finally {
      setActing(null);
    }
  }

  function confirmDelete(schedule) {
    ask({
      title: 'Delete this schedule?',
      message: 'It stops immediately and disappears from this list. Delivery history is kept.',
      confirmLabel: 'Delete schedule',
      onConfirm: async () => {
        setActing(schedule.id);
        try {
          await api(`/schedules/${schedule.id}`, { method: 'DELETE' });
          notify('Schedule deleted.', 'info');
        } catch (err) {
          notify(err.message, 'error');
        } finally {
          setActing(null);
          await loadAll();
        }
      },
    });
  }

  const noData = loaded && (!customers.length || !templates.length);

  return (
    <section>
      {dialog}
      <h2>Scheduled reminders</h2>

      {noData && (
        <div className="callout">
          Add at least one customer and one message template before scheduling anything.
        </div>
      )}

      <form className="card" onSubmit={onSubmit}>
        <label>Who should receive this?</label>
        <div className="row wrap">
          {TARGET_TYPES.map((t) => (
            <label key={t.value} className="radio">
              <input
                type="radio"
                name="targetType"
                checked={form.targetType === t.value}
                onChange={() => set({ targetType: t.value })}
              />
              {t.label}
            </label>
          ))}
        </div>

        <div className="grid2">
          <div>
            {form.targetType === 'customer' && (
              <>
                <label htmlFor="sch-customer">Customer</label>
                <select
                  id="sch-customer"
                  value={form.customerId}
                  onChange={(e) => set({ customerId: e.target.value })}
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </>
            )}
            {form.targetType === 'tag' && (
              <>
                <label htmlFor="sch-tag">Group</label>
                <select id="sch-tag" value={form.tag} onChange={(e) => set({ tag: e.target.value })}>
                  <option value="">Select group...</option>
                  {tags.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.count})
                    </option>
                  ))}
                </select>
                {!tags.length && (
                  <p className="muted small">
                    No groups yet — add tags to customers on the Customers page.
                  </p>
                )}
              </>
            )}
            {form.targetType === 'all' && (
              <>
                <label>Everyone</label>
                <p className="muted">All {customers.length} customers in your list.</p>
              </>
            )}
          </div>

          <div>
            <label htmlFor="sch-template">Message template</label>
            <select
              id="sch-template"
              value={form.templateId}
              onChange={(e) => set({ templateId: e.target.value })}
            >
              <option value="">Select template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {form.templateId && templateById[form.templateId] && (
          <div className="preview">
            <span className="preview-label">Message</span>
            <div className="bubble">{templateById[form.templateId].body}</div>
          </div>
        )}

        <label>When?</label>
        <div className="row wrap">
          {SEND_TYPES.map((t) => (
            <label key={t.value} className="radio">
              <input
                type="radio"
                name="sendType"
                checked={form.sendType === t.value}
                onChange={() => set({ sendType: t.value })}
              />
              {t.label}
            </label>
          ))}
        </div>

        <div className="grid2">
          {form.sendType === 'once' && (
            <div>
              <label htmlFor="sch-once">Date and time</label>
              <input
                id="sch-once"
                type="datetime-local"
                min={localInputNow()}
                value={form.onceAt}
                onChange={(e) => set({ onceAt: e.target.value })}
              />
            </div>
          )}

          {(form.sendType === 'daily' || form.sendType === 'weekly') && (
            <div>
              <label htmlFor="sch-time">Time of day</label>
              <input
                id="sch-time"
                type="time"
                value={form.timeOfDay}
                onChange={(e) => set({ timeOfDay: e.target.value })}
              />
            </div>
          )}

          {form.sendType === 'weekly' && (
            <div>
              <label htmlFor="sch-weekday">Day of the week</label>
              <select
                id="sch-weekday"
                value={form.weekday}
                onChange={(e) => set({ weekday: Number(e.target.value) })}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="summary">
          <strong>{recipientCount}</strong> recipient{recipientCount === 1 ? '' : 's'}
          {firstRun && form.sendType !== 'immediate' && (
            <>
              {' · first message '}
              <strong>{formatDateTime(firstRun)}</strong>{' '}
              <span className="muted">({relativeTime(firstRun)})</span>
            </>
          )}
          {form.sendType === 'immediate' && ' · sending straight away'}
          {recipientCount > 3 && (
            <span className="muted">
              {' '}
              · messages are spaced a few seconds apart, so a large group takes a while
            </span>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        <button className="btn primary" disabled={busy || noData}>
          {busy ? 'Working...' : form.sendType === 'immediate' ? 'Send now' : 'Schedule'}
        </button>
      </form>

      {loadError && <p className="error">Could not refresh: {loadError}</p>}

      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Recipients</th>
              <th>Template</th>
              <th>Repeats</th>
              <th>Next run</th>
              <th>Last sent</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => {
              const { who, when } = describeSchedule(s, {
                customerName: customerById[s.customer_id]?.name,
              });
              const template = templateById[s.template_id];
              return (
                <tr key={s.id}>
                  <td>{who}</td>
                  <td>{template ? template.name : <span className="muted">Deleted</span>}</td>
                  <td>{when}</td>
                  <td>
                    {s.status === 'active' ? (
                      <>
                        {formatDateTime(s.schedule_time)}
                        <div className="muted small">{relativeTime(s.schedule_time)}</div>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{s.last_sent ? formatDateTime(s.last_sent) : <span className="muted">—</span>}</td>
                  <td>
                    <span className={`badge ${s.status}`}>{s.status}</span>
                    {s.last_error && <div className="muted small">{s.last_error}</div>}
                  </td>
                  <td className="actions">
                    {s.status === 'active' && (
                      <button
                        className="btn ghost sm"
                        disabled={acting === s.id}
                        onClick={() => act(s, 'cancel', 'Schedule cancelled.')}
                      >
                        Cancel
                      </button>
                    )}
                    {s.status !== 'active' &&
                      (s.send_type === 'daily' || s.send_type === 'weekly') && (
                        <button
                          className="btn ghost sm"
                          disabled={acting === s.id}
                          onClick={() => act(s, 'resume', 'Schedule resumed.')}
                        >
                          Resume
                        </button>
                      )}
                    <button
                      className="btn danger sm"
                      disabled={acting === s.id}
                      onClick={() => confirmDelete(s)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {loaded && !schedules.length && (
              <Empty colSpan={7}>No reminders scheduled yet.</Empty>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
