import { useCallback, useEffect, useState } from 'react';
import api from '../api.js';
import { formatDateTime } from '../lib/schedule.js';
import { Empty } from './ui.jsx';

const PAGE_SIZE = 50;

export default function LogsView() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(
    async (signal) => {
      try {
        const d = await api('/logs', {
          signal,
          query: { limit: PAGE_SIZE, offset, status },
        });
        setLogs(d.logs || []);
        setTotal(d.total || 0);
        setError('');
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        setLoaded(true);
      }
    },
    [offset, status]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // The old version loaded once and then went stale, which is unhelpful on the
  // one page where you are usually watching for something to happen.
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const controller = new AbortController();
    const timer = setInterval(() => load(controller.signal), 15_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [autoRefresh, load]);

  const failed = logs.filter((l) => l.status === 'failed').length;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <div className="row between section-head">
        <h2>Delivery log</h2>
        <label className="radio">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh
        </label>
      </div>

      <div className="row wrap filter-row">
        {[
          ['', 'All'],
          ['success', 'Delivered'],
          ['failed', 'Failed'],
        ].map(([value, label]) => (
          <button
            key={value || 'all'}
            type="button"
            className={`btn sm ${status === value ? 'primary' : 'ghost'}`}
            onClick={() => {
              setStatus(value);
              setOffset(0);
            }}
          >
            {label}
          </button>
        ))}
        <span className="muted">
          {total} entr{total === 1 ? 'y' : 'ies'}
          {failed > 0 && status !== 'failed' && ` · ${failed} failed on this page`}
        </span>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Message</th>
              <th>Status</th>
              <th>Sent at</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.customers ? l.customers.name : <span className="muted">—</span>}</td>
                <td className="prewrap clamp">{l.message_body || <span className="muted">—</span>}</td>
                <td>
                  <span className={`badge ${l.status}`}>
                    {l.status === 'success' ? 'delivered' : 'failed'}
                  </span>
                </td>
                <td>{formatDateTime(l.sent_at)}</td>
                <td className="muted">{l.error || '—'}</td>
              </tr>
            ))}
            {loaded && !logs.length && (
              <Empty colSpan={5}>
                {status ? 'Nothing matches that filter.' : 'No messages have been sent yet.'}
              </Empty>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="row between">
          <button
            className="btn ghost sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Previous
          </button>
          <span className="muted">
            Page {page} of {pages}
          </span>
          <button
            className="btn ghost sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
