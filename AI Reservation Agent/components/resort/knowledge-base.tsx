"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import {
  createKnowledgeEntryAction,
  updateKnowledgeEntryAction,
  deleteKnowledgeEntryAction,
} from "@/app/(dashboard)/dashboard/resort-info/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { ClientKnowledgeEntry } from "@/components/resort/types";

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

const KB_TYPES = ["FACILITY", "POLICY", "FAQ", "LOCATION", "CONTACT", "OTHER"];

function TypeBadge({ type, dict }: { type: string; dict: Dictionary }) {
  const colors: Record<string, string> = {
    FACILITY: "bg-sky-50 text-sky-700",
    POLICY: "bg-amber-50 text-amber-700",
    FAQ: "bg-emerald-50 text-emerald-700",
    LOCATION: "bg-violet-50 text-violet-700",
    CONTACT: "bg-rose-50 text-rose-700",
    OTHER: "bg-stone-100 text-stone-600",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors[type] ?? colors.OTHER}`}>
      {dict.kb.types[type] ?? dict.kb.types.OTHER}
    </span>
  );
}

function EntryForm({
  entry,
  propertyId,
  dict,
  onDone,
  isCreate,
}: {
  entry?: ClientKnowledgeEntry;
  propertyId: string;
  dict: Dictionary;
  onDone: () => void;
  isCreate: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    isCreate ? createKnowledgeEntryAction : updateKnowledgeEntryAction,
    { ok: false }
  );

  useEffect(() => {
    if (!state.ok) return;
    const timer = setTimeout(onDone, 50);
    return () => clearTimeout(timer);
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
      <input type="hidden" name="propertyId" value={propertyId} />
      {!isCreate && entry ? <input type="hidden" name="entryId" value={entry.id} /> : null}
      <input type="hidden" name="sortOrder" value="0" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{dict.kb.type}</label>
          <select name="type" defaultValue={entry?.type ?? "FAQ"} className={inputClass} required>
            {KB_TYPES.map((type) => (
              <option key={type} value={type}>
                {dict.kb.types[type]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{dict.kb.question}</label>
          <input name="question" type="text" dir="auto" defaultValue={entry?.question ?? ""} className={inputClass} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{dict.kb.contentEn}</label>
          <textarea name="contentEn" dir="ltr" rows={3} defaultValue={entry?.contentEn ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{dict.kb.contentAr}</label>
          <textarea name="contentAr" dir="rtl" rows={3} defaultValue={entry?.contentAr ?? ""} className={inputClass} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={entry ? entry.isActive : true}
          className="h-4 w-4 rounded border-stone-300 accent-emerald-600"
        />
        {dict.kb.active}
      </label>

      {state.error ? <p className="text-sm text-red-600">{dict.resort.saveError}</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "…" : dict.kb.save}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
        >
          {dict.kb.cancel}
        </button>
      </div>
    </form>
  );
}

function EntryCard({
  entry,
  dict,
  confirming,
  onEdit,
  onDelete,
}: {
  entry: ClientKnowledgeEntry;
  dict: Dictionary;
  confirming: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={entry.type} dict={dict} />
          {!entry.isActive ? (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
              {dict.kb.inactive}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            {dict.kb.edit}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={
              confirming
                ? "rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                : "rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            }
          >
            {confirming ? dict.kb.confirmDelete : dict.kb.delete}
          </button>
        </div>
      </div>

      {entry.question ? (
        <h4 className="mt-3 text-sm font-semibold text-stone-900">{entry.question}</h4>
      ) : null}

      <div className="mt-2 space-y-1.5 text-sm text-stone-600">
        {entry.contentEn ? <p className="rounded-lg bg-stone-50 p-2.5" dir="ltr">{entry.contentEn}</p> : null}
        {entry.contentAr ? <p className="rounded-lg bg-stone-50 p-2.5" dir="rtl">{entry.contentAr}</p> : null}
      </div>
    </div>
  );
}

export function KnowledgeBase({
  propertyId,
  entries,
  dict,
}: {
  propertyId: string;
  entries: ClientKnowledgeEntry[];
  dict: Dictionary;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [createNonce, setCreateNonce] = useState(0);
  const [deleteState, deleteAction] = useActionState(deleteKnowledgeEntryAction, { ok: false });

  useEffect(() => {
    if (!deleteState.ok) return;
    const timer = setTimeout(() => setConfirmDeleteId(null), 50);
    return () => clearTimeout(timer);
  }, [deleteState]);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmDeleteId]);

  function resetCreate() {
    setCreating(false);
    setCreateNonce((n) => n + 1);
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900">{dict.kb.title}</h2>
          <p className="mt-1 text-sm text-stone-500">{dict.kb.subtitle}</p>
        </div>
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + {dict.kb.addEntry}
          </button>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        {creating ? (
          <EntryForm
            key={`create-${createNonce}`}
            propertyId={propertyId}
            dict={dict}
            isCreate
            onDone={resetCreate}
          />
        ) : null}

        {editingId ? (
          (() => {
            const entry = entries.find((e) => e.id === editingId);
            if (!entry) return null;
            return (
              <EntryForm
                key={`edit-${editingId}`}
                entry={entry}
                propertyId={propertyId}
                dict={dict}
                isCreate={false}
                onDone={() => setEditingId(null)}
              />
            );
          })()
        ) : null}

        {entries.map((entry) =>
          entry.id === editingId ? null : (
            <EntryCard
              key={entry.id}
              entry={entry}
              dict={dict}
              confirming={confirmDeleteId === entry.id}
              onEdit={() => setEditingId(entry.id)}
              onDelete={() => {
                if (confirmDeleteId === entry.id) {
                  const formData = new FormData();
                  formData.set("propertyId", propertyId);
                  formData.set("entryId", entry.id);
                  deleteAction(formData);
                } else {
                  setConfirmDeleteId(entry.id);
                }
              }}
            />
          )
        )}

      {entries.length === 0 && !creating ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-stone-700">{dict.kb.empty}</p>
          <p className="mt-1 text-sm text-stone-500">{dict.kb.emptyHint}</p>
        </div>
      ) : null}
      </div>
    </section>
  );
}
