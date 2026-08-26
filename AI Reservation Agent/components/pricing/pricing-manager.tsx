"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  createPricingRuleAction,
  updatePricingRuleAction,
  deletePricingRuleAction,
  changePriorityAction,
  calculatePriceAction,
} from "@/app/(dashboard)/dashboard/pricing/actions";
import type { PriceBreakdownItem } from "@/lib/services/pricing";

type Rule = {
  id: string;
  name: string;
  pricePerNight: string;
  startDate: string;
  endDate: string;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  isRecurringHijri: boolean;
};

type PreviewResult = {
  nights: number;
  breakdown: PriceBreakdownItem[];
  totalPrice: number;
  deposit: number;
  remainingBalance: number;
};

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

const L = {
  en: {
    title: "Season Pricing Rules",
    add: "Add rule",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    name: "Season name",
    price: "Price/night (OMR)",
    start: "Start date",
    end: "End date (inclusive)",
    priority: "Priority",
    default: "Default (fallback)",
    active: "Active",
    hijri: "Hijri (auto-update reminder)",
    previewTitle: "Price preview",
    previewHint: "Enter a date range to see the per-night breakdown.",
    checkIn: "Check-in",
    checkOut: "Check-out",
    getPreview: "Calculate",
    nights: "nights",
    total: "Total",
    deposit: "Deposit",
    remaining: "Remaining",
    deleteConfirm: "Confirm delete?",
    moveUp: "↑",
    moveDown: "↓",
    normal: "Normal",
    summer: "Summer",
    ramadan: "Ramadan",
    eid: "Eid",
    nationalDay: "National Day",
  },
  ar: {
    title: "قواعد تسعير الفصول",
    add: "إضافة قاعدة",
    edit: "تعديل",
    delete: "حذف",
    save: "حفظ",
    cancel: "إلغاء",
    name: "اسم الموسم",
    price: "السعر/ليلة (ريال عماني)",
    start: "تاريخ البداية",
    end: "تاريخ النهاية (شامل)",
    priority: "الأولوية",
    default: "افتراضي (بديل)",
    active: "نشط",
    hijri: "هجري (تذكير بالتحديث)",
    previewTitle: "معاينة السعر",
    previewHint: "أدخل نطاق التاريخ لرؤية تفصيل الليلة الواحدة.",
    checkIn: "تسجيل الوصول",
    checkOut: "تسجيل المغادرة",
    getPreview: "حساب",
    nights: "ليالٍ",
    total: "الإجمالي",
    deposit: "العربون",
    remaining: "المتبقي",
    deleteConfirm: "تأكيد الحذف؟",
    moveUp: "↑",
    moveDown: "↓",
    normal: "عادي",
    summer: "صيف",
    ramadan: "رمضان",
    eid: "عيد",
    nationalDay: "اليوم الوطني",
  },
};

function RuleForm({
  rule,
  propertyId,
  lang,
  isCreate,
  onDone,
}: {
  rule?: Rule;
  propertyId: string;
  lang: typeof L.en;
  isCreate: boolean;
  onDone: () => void;
}) {
  const action = isCreate ? createPricingRuleAction : updatePricingRuleAction;
  const [state, formAction, pending] = useActionState(action, { ok: false });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formAction(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
      <input type="hidden" name="propertyId" value={propertyId} />
      {rule ? <input type="hidden" name="ruleId" value={rule.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.name}</label>
          <input name="name" type="text" required defaultValue={rule?.name ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.price}</label>
          <input name="pricePerNight" type="number" step="0.5" min="0" required defaultValue={rule?.pricePerNight ?? "160"} className={inputClass} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.start}</label>
          <input name="startDate" type="date" required defaultValue={rule?.startDate ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.end}</label>
          <input name="endDate" type="date" required defaultValue={rule?.endDate ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.priority}</label>
          <input name="priority" type="number" min="1" max="10" required defaultValue={rule?.priority ?? 5} className={inputClass} />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="isDefault" defaultChecked={rule?.isDefault ?? false} className="h-4 w-4 rounded border-stone-300 accent-emerald-600" />
          {lang.default}
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="isActive" defaultChecked={rule ? rule.isActive : true} className="h-4 w-4 rounded border-stone-300 accent-emerald-600" />
          {lang.active}
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="isRecurringHijri" defaultChecked={rule?.isRecurringHijri ?? false} className="h-4 w-4 rounded border-stone-300 accent-emerald-600" />
          {lang.hijri}
        </label>
      </div>

      {!state.ok && state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {pending ? "…" : lang.save}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">
          {lang.cancel}
        </button>
      </div>
    </form>
  );
}

function PricePreview({ propertyId, lang }: { propertyId: string; lang: typeof L.en }) {
  const [state, formAction, pending] = useActionState(calculatePriceAction, { ok: false });
  const result = state.ok && state.data ? (state.data as PreviewResult) : null;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6">
      <h2 className="text-base font-semibold text-stone-900">{lang.previewTitle}</h2>
      <p className="mt-1 text-sm text-stone-500">{lang.previewHint}</p>

      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="propertyId" value={propertyId} />
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.checkIn}</label>
          <input name="checkIn" type="date" required className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.checkOut}</label>
          <input name="checkOut" type="date" required className={inputClass} />
        </div>
        <button type="submit" disabled={pending} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60">
          {pending ? "…" : lang.getPreview}
        </button>
      </form>

      {!state.ok && state.error ? (
        <p className="mt-3 text-sm text-red-600">{state.error}</p>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium text-stone-700">
            {result.nights} {lang.nights}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs font-medium uppercase text-stone-500">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Season</th>
                  <th className="pb-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {result.breakdown.map((item) => (
                  <tr key={item.date} className="border-b border-stone-100">
                    <td className="py-2 pr-4 text-stone-900">{item.date}</td>
                    <td className="py-2 pr-4 text-stone-600">{item.season}</td>
                    <td className="py-2 text-right text-stone-900">{item.pricePerNight.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-stone-900">
                  <td className="pt-2 pr-4" colSpan={2}>{lang.total}</td>
                  <td className="pt-2 text-right">{result.totalPrice.toFixed(1)}</td>
                </tr>
                <tr className="text-stone-600">
                  <td className="pt-1 pr-4" colSpan={2}>{lang.deposit}</td>
                  <td className="pt-1 text-right">{result.deposit.toFixed(1)}</td>
                </tr>
                <tr className="font-medium text-stone-900">
                  <td className="pt-1 pr-4" colSpan={2}>{lang.remaining}</td>
                  <td className="pt-1 text-right">{result.remainingBalance.toFixed(1)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function PricingManager({
  propertyId,
  rules: initialRules,
  locale,
}: {
  propertyId: string;
  rules: Rule[];
  locale: "en" | "ar";
}) {
  const lang = locale === "ar" ? L.ar : L.en;
  const [rules, setRules] = useState(initialRules);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handlePriority(ruleId: string, direction: "up" | "down") {
    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("ruleId", ruleId);
    formData.set("direction", direction);
    await changePriorityAction({ ok: false }, formData);
    setRules((prev) => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
      const idx = sorted.findIndex((r) => r.id === ruleId);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      return sorted.map((r) => {
        if (r.id === a.id) return { ...r, priority: b.priority };
        if (r.id === b.id) return { ...r, priority: a.priority };
        return r;
      });
    });
  }

  async function handleDelete(ruleId: string) {
    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("ruleId", ruleId);
    await deletePricingRuleAction({ ok: false }, formData);
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    setConfirmDeleteId(null);
  }

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h2 className="text-base font-semibold text-stone-900">{lang.title}</h2>
        {!creating && !editingId ? (
          <button onClick={() => setCreating(true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            + {lang.add}
          </button>
        ) : null}
      </div>

      {creating ? (
        <RuleForm
          propertyId={propertyId}
          lang={lang}
          isCreate
          onDone={() => setCreating(false)}
        />
      ) : null}

      {editingId ? (
        (() => {
          const rule = rules.find((r) => r.id === editingId);
          if (!rule) return null;
          return (
            <RuleForm
              key={`edit-${editingId}`}
              rule={rule}
              propertyId={propertyId}
              lang={lang}
              isCreate={false}
              onDone={() => setEditingId(null)}
            />
          );
        })()
      ) : null}

      <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-medium uppercase text-stone-500">
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">{lang.name}</th>
              <th className="px-4 py-3">{lang.price}</th>
              <th className="px-4 py-3">{lang.start} → {lang.end}</th>
              <th className="px-4 py-3">{lang.default}</th>
              <th className="px-4 py-3">{lang.active}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sortedRules.map((rule, idx) => (
              <tr key={rule.id} className={`border-b border-stone-100 ${!rule.isActive ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-stone-900">{rule.priority}</span>
                    <div className="flex flex-col">
                      <button
                        onClick={() => handlePriority(rule.id, "up")}
                        disabled={idx === 0}
                        className="text-xs text-stone-400 hover:text-stone-700 disabled:opacity-30"
                      >
                        {lang.moveUp}
                      </button>
                      <button
                        onClick={() => handlePriority(rule.id, "down")}
                        disabled={idx === sortedRules.length - 1}
                        className="text-xs text-stone-400 hover:text-stone-700 disabled:opacity-30"
                      >
                        {lang.moveDown}
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-stone-900">{rule.name}</td>
                <td className="px-4 py-3 text-stone-700">{rule.pricePerNight}</td>
                <td className="px-4 py-3 text-stone-600">{rule.startDate} → {rule.endDate}</td>
                <td className="px-4 py-3">
                  {rule.isDefault ? (
                    <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">✓</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {rule.isActive ? (
                    <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">✓</span>
                  ) : (
                    <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === rule.id ? null : (
                    <div className="flex gap-1">
                      <button onClick={() => setEditingId(rule.id)} className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100">
                        {lang.edit}
                      </button>
                      {confirmDeleteId === rule.id ? (
                        <button onClick={() => handleDelete(rule.id)} className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">
                          {lang.deleteConfirm}
                        </button>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(rule.id)} className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                          {lang.delete}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedRules.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-stone-500">No rules configured</div>
        ) : null}
      </section>

      <PricePreview propertyId={propertyId} lang={lang} />
    </div>
  );
}
