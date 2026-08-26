import { useCallback, useEffect, useRef, useState } from 'react';

/* ----------------------------- confirm dialog ---------------------------- */

/**
 * Deleting a customer cascades to their scheduled reminders, and deleting a
 * template cancels every schedule using it. The old UI did both on a single
 * click with no warning at all.
 */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', danger = true, onConfirm, onCancel }) {
  const confirmRef = useRef(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  // Deliberately keyed on `open` alone. Listing onCancel here would re-run the
  // effect on every parent render -- and a background poll re-rendering the page
  // would yank focus back onto the destructive button while the user was tabbing
  // towards Cancel.
  useEffect(() => {
    if (!open) return undefined;
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') cancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        <p className="muted">{message}</p>
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`btn ${danger ? 'danger solid' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Hook that wires a ConfirmDialog to an async action. */
export function useConfirm() {
  const [state, setState] = useState(null);

  const ask = useCallback((config) => setState(config), []);
  const close = useCallback(() => setState(null), []);

  const dialog = (
    <ConfirmDialog
      open={Boolean(state)}
      title={state?.title || ''}
      message={state?.message || ''}
      confirmLabel={state?.confirmLabel}
      danger={state?.danger !== false}
      onCancel={close}
      onConfirm={async () => {
        const action = state?.onConfirm;
        close();
        if (action) await action();
      }}
    />
  );

  return { ask, dialog };
}

/* --------------------------------- toast --------------------------------- */

export function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onDismiss, toast.type === 'error' ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className={`toast ${toast.type || 'info'}`} role="status">
      <span>{toast.message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);

  // Stable identities matter here: Toast's auto-dismiss timer lists onDismiss as
  // a dependency, so a fresh function on every render would restart the countdown
  // each time the app re-renders and the toast would never go away.
  const notify = useCallback((message, type = 'info') => setToast({ message, type }), []);
  const dismiss = useCallback(() => setToast(null), []);

  return { toast, notify, dismiss };
}

/* ------------------------------- tag input ------------------------------- */

export function TagInput({ value = [], onChange, suggestions = [], placeholder = 'Add a group...' }) {
  const [draft, setDraft] = useState('');

  function add(raw) {
    const tag = String(raw || '').trim().toLowerCase();
    if (!tag) return;
    if (value.includes(tag)) {
      setDraft('');
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  const unused = suggestions.filter((s) => !value.includes(s));

  return (
    <div>
      <div className="tag-input">
        {value.map((tag) => (
          <span className="chip" key={tag}>
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length ? '' : placeholder}
        />
      </div>
      {unused.length > 0 && (
        <div className="chip-row">
          <span className="muted">Existing groups:</span>
          {unused.slice(0, 12).map((tag) => (
            <button type="button" key={tag} className="chip ghost" onClick={() => add(tag)}>
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ small bits ------------------------------- */

export function Empty({ children, colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} className="empty-cell muted">
        {children}
      </td>
    </tr>
  );
}

export function Spinner({ label = 'Loading...' }) {
  return <p className="muted">{label}</p>;
}
