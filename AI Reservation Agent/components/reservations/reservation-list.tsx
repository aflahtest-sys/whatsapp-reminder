"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useActionState } from "react";
import {
  createReservationAction,
  updateReservationAction,
  cancelReservationAction,
  markDepositPaidAction,
  completeReservationAction,
  getReservationsAction,
} from "@/app/(dashboard)/dashboard/reservations/actions";
import { calculatePriceAction } from "@/app/(dashboard)/dashboard/pricing/actions";
import type { ActionResult } from "@/app/(dashboard)/dashboard/reservations/actions";
import { AvailabilityBar } from "@/components/reservations/availability-bar";

type SerializedReservation = {
  id: string;
  customerId: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  totalPrice: number;
  depositAmount: number;
  remainingBalance: number;
  status: string;
  source: string;
  cancellationReason: string | null;
  depositRefundable: boolean | null;
  notes: string | null;
  createdAt: string;
  customer: { name: string; phone: string; email: string | null };
  payments: {
    id: string;
    type: string;
    amount: number;
    status: string;
    method: string;
    paidAt: string | null;
    verifiedBy: string | null;
  }[];
};

type Props = {
  reservations: SerializedReservation[];
  customers: { id: string; name: string; phone: string }[];
  propertyId: string;
  locale: "en" | "ar";
};

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

const statusStyles: Record<string, string> = {
  PAYMENT_PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 ring-1 ring-red-200",
  COMPLETED: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
};

const statusLabels: Record<string, { en: string; ar: string }> = {
  PAYMENT_PENDING: { en: "Pending", ar: "Ø¨Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„Ø¯ÙØ¹" },
  CONFIRMED: { en: "Confirmed", ar: "Ù…Ø¤ÙƒØ¯" },
  CANCELLED: { en: "Cancelled", ar: "Ù…Ù„ØºÙŠ" },
  COMPLETED: { en: "Completed", ar: "Ù…ÙƒØªÙ…Ù„" },
};

const L = {
  en: {
    newReservation: "New Reservation",
    guest: "Guest",
    checkIn: "Check-in",
    checkOut: "Check-out",
    nights: "Nights",
    total: "Total",
    status: "Status",
    actions: "Actions",
    view: "View",
    markPaid: "Mark Deposit Paid",
    all: "All",
    search: "Search guest name or phone\u2026",
    dateFrom: "Check-in from",
    dateTo: "Check-in to",
    customer: "Customer",
    guests: "Guests",
    notes: "Notes",
    save: "Save",
    cancel: "Cancel",
    confirmCancel: "Confirm Cancel",
    complete: "Complete",
    edit: "Edit",
    paymentHistory: "Payment History",
    cancellationReason: "Cancellation Reason",
    depositRefundable: "Deposit Refundable",
    yes: "Yes",
    no: "No",
    totalLabel: "Total",
    depositLabel: "Deposit",
    remainingLabel: "Remaining",
    nightsLabel: "nights",
    omr: "OMR",
    close: "Close",
    noReservations: "No reservations found",
    cancelReservation: "Cancel Reservation",
    cancelHint: "Are you sure you want to cancel this reservation?",
    reasonPlaceholder: "Reason for cancellation (optional)",
    markPaidHint: "Mark the deposit as paid and confirm the reservation.",
    completeHint: "Mark this reservation as completed.",
    editReservation: "Edit Reservation",
    source: "Source",
    createdAt: "Created",
  },
  ar: {
    newReservation: "\u062d\u062c\u0632 \u062c\u062f\u064a\u062f",
    guest: "\u0627\u0644\u0636\u064a\u0641",
    checkIn: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0648\u0635\u0648\u0644",
    checkOut: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0645\u063a\u0627\u062f\u0631\u0629",
    nights: "\u0627\u0644\u0644\u064a\u0627\u0644\u064a",
    total: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a",
    status: "\u0627\u0644\u062d\u0627\u0644\u0629",
    actions: "\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a",
    view: "\u0639\u0631\u0636",
    markPaid: "\u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0639\u0631\u0628\u0648\u0646 \u0643\u0645\u062f\u0641\u0648\u0639",
    all: "\u0627\u0644\u0643\u0644",
    search: "\u0628\u062d\u062b \u0628\u0627\u0633\u0645 \u0627\u0644\u0636\u064a\u0641 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641\u2026",
    dateFrom: " \u0627\u0644\u0648\u0635\u0648\u0644 \u0645\u0646",
    dateTo: " \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649",
    customer: "\u0627\u0644\u0639\u0645\u064a\u0644",
    guests: "\u0627\u0644\u0636\u064a\u0648\u0641",
    notes: "\u0645\u0644\u0627\u062d\u0638\u0627\u062a",
    save: "\u062d\u0641\u0638",
    cancel: "\u0625\u0644\u063a\u0627\u0621",
    confirmCancel: "\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0625\u0644\u063a\u0627\u0621",
    complete: "\u0625\u062a\u0645\u0627\u0645",
    edit: "\u062a\u0639\u062f\u064a\u0644",
    paymentHistory: "\u0633\u062c\u0644 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a",
    cancellationReason: "\u0633\u0628\u0628 \u0627\u0644\u0625\u0644\u063a\u0627\u0621",
    depositRefundable: "\u0627\u0644\u0639\u0631\u0628\u0648\u0646 \u0645\u0633\u062a\u0631\u062f",
    yes: "\u0646\u0639\u0645",
    no: "\u0644\u0627",
    totalLabel: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a",
    depositLabel: "\u0627\u0644\u0639\u0631\u0628\u0648\u0646",
    remainingLabel: "\u0627\u0644\u0645\u062a\u0628\u0642\u064a",
    nightsLabel: "\u0644\u064a\u0627\u0644\u064a",
    omr: "\u0631.\u0639.",
    close: "\u0625\u063a\u0644\u0627\u0642",
    noReservations: "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u062d\u062c\u0648\u0632\u0627\u062a",
    cancelReservation: "\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062d\u062c\u0632",
    cancelHint: "\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u0625\u0644\u063a\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u062d\u062c\u0632\uff1f",
    reasonPlaceholder: "\u0633\u0628\u0628 \u0627\u0644\u0625\u0644\u063a\u0627\u0621 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)",
    markPaidHint: "\u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0639\u0631\u0628\u0648\u0646 \u0643\u0645\u062f\u0641\u0648\u0639 \u0648\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062d\u062c\u0632.",
    completeHint: "\u062a\u062d\u062f\u064a\u062f \u0647\u0630\u0627 \u0627\u0644\u062d\u062c\u0632 \u0643\u0645\u0643\u062a\u0645\u0644.",
    editReservation: "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u062d\u062c\u0632",
    source: "\u0627\u0644\u0645\u0635\u062f\u0631",
    createdAt: "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u0646\u0634\u0627\u0621",
  },
};

function formatCurrency(amount: number): string {
  return amount.toFixed(3);
}

function formatDate(iso: string): string {
  return iso.split("T")[0];
}

function getDaysUntilCheckIn(checkIn: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ci = new Date(checkIn);
  ci.setHours(0, 0, 0, 0);
  return Math.ceil((ci.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function ReservationList({
  reservations: initial,
  customers,
  propertyId,
  locale,
}: Props) {
  const lang = locale === "ar" ? L.ar : L.en;
  const [reservations, setReservations] = useState(initial);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    checkInFrom: "",
    checkInTo: "",
  });
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingDetail, setEditingDetail] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const [createState, createFormAction, createPending] = useActionState(
    createReservationAction,
    { ok: false } as ActionResult
  );
  const [updateState, updateFormAction, updatePending] = useActionState(
    updateReservationAction,
    { ok: false } as ActionResult
  );
  const [cancelState, cancelFormAction, cancelPending] = useActionState(
    cancelReservationAction,
    { ok: false } as ActionResult
  );
  const [calcState, calcFormAction, calcPending] = useActionState(
    calculatePriceAction,
    { ok: false } as ActionResult
  );

  const refresh = useCallback(async () => {
    const f = filtersRef.current;
    const formData = new FormData();
    if (f.search) formData.set("search", f.search);
    if (f.status) formData.set("status", f.status);
    if (f.checkInFrom) formData.set("checkInFrom", f.checkInFrom);
    if (f.checkInTo) formData.set("checkInTo", f.checkInTo);
    const result = await getReservationsAction({ ok: false }, formData);
    if (result.ok && result.data) {
      setReservations(result.data as SerializedReservation[]);
    }
  }, []);

  useEffect(() => {
    if (createState.ok) {
      setTimeout(() => { refresh(); setShowCreate(false); }, 0);
    }
  }, [createState, refresh]);

  useEffect(() => {
    if (updateState.ok) {
      setTimeout(() => { refresh(); setEditingDetail(false); }, 0);
    }
  }, [updateState, refresh]);

  useEffect(() => {
    if (cancelState.ok) {
      setTimeout(() => { refresh(); setShowCancel(false); setDetailId(null); }, 0);
    }
  }, [cancelState, refresh]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refresh, filters.search ? 300 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters.search, filters.status, filters.checkInFrom, filters.checkInTo, refresh]);

  function updateFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handleMarkDepositPaid(reservationId: string) {
    const formData = new FormData();
    formData.set("reservationId", reservationId);
    const result = await markDepositPaidAction({ ok: false }, formData);
    if (result.ok) {
      refresh();
      setDetailId(null);
    }
  }

  async function handleComplete(reservationId: string) {
    const formData = new FormData();
    formData.set("reservationId", reservationId);
    const result = await completeReservationAction({ ok: false }, formData);
    if (result.ok) {
      refresh();
      setDetailId(null);
    }
  }

  const detailReservation = detailId
    ? reservations.find((r) => r.id === detailId)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          placeholder={lang.search}
          className="w-full max-w-xs rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">{lang.status}</label>
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">{lang.all}</option>
            <option value="PAYMENT_PENDING">{statusLabels.PAYMENT_PENDING[locale]}</option>
            <option value="CONFIRMED">{statusLabels.CONFIRMED[locale]}</option>
            <option value="CANCELLED">{statusLabels.CANCELLED[locale]}</option>
            <option value="COMPLETED">{statusLabels.COMPLETED[locale]}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">{lang.dateFrom}</label>
          <input
            type="date"
            value={filters.checkInFrom}
            onChange={(e) => updateFilter("checkInFrom", e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">{lang.dateTo}</label>
          <input
            type="date"
            value={filters.checkInTo}
            onChange={(e) => updateFilter("checkInTo", e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + {lang.newReservation}
          </button>
        )}
      </div>

      {showCreate && (
          <CreateReservationForm
            customers={customers}
            propertyId={propertyId}
            formAction={createFormAction}
            pending={createPending}
            state={createState}
            lang={lang}
            onCancel={() => setShowCreate(false)}
          />
      )}

      {(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days: { date: string; status: "available" | "booked" | "payment_pending" | "blocked" }[] = [];
        for (let i = 0; i < 30; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split("T")[0];
          const overlapping = reservations.find((r) => {
            if (r.status === "CANCELLED") return false;
            const ci = r.checkIn.split("T")[0];
            const co = r.checkOut.split("T")[0];
            return dateStr >= ci && dateStr < co;
          });
          let status: "available" | "booked" | "payment_pending" | "blocked" = "available";
          if (overlapping) {
            if (overlapping.status === "PAYMENT_PENDING") status = "payment_pending";
            else status = "booked";
          }
          days.push({ date: dateStr, status });
        }
        return <AvailabilityBar days={days} locale={locale} />;
      })()}

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-medium uppercase text-stone-500">
              <th className="px-4 py-3">{lang.guest}</th>
              <th className="px-4 py-3">{lang.checkIn}</th>
              <th className="px-4 py-3">{lang.checkOut}</th>
              <th className="px-4 py-3">{lang.nights}</th>
              <th className="px-4 py-3">{lang.total}</th>
              <th className="px-4 py-3">{lang.status}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id} className="border-b border-stone-100">
                <td className="px-4 py-3 font-medium text-stone-900">{r.customer.name}</td>
                <td className="px-4 py-3 text-stone-700">{formatDate(r.checkIn)}</td>
                <td className="px-4 py-3 text-stone-700">{formatDate(r.checkOut)}</td>
                <td className="px-4 py-3 text-stone-600">{r.nights}</td>
                <td className="px-4 py-3 text-stone-900">{formatCurrency(r.totalPrice)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      statusStyles[r.status] ?? "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {statusLabels[r.status]?.[locale] ?? r.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setDetailId(r.id);
                        setEditingDetail(false);
                        setShowCancel(false);
                      }}
                      className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                    >
                      {lang.view}
                    </button>
                    {r.status === "PAYMENT_PENDING" && (
                      <button
                        onClick={() => handleMarkDepositPaid(r.id)}
                        className="rounded border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        {lang.markPaid}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reservations.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-stone-500">
            {lang.noReservations}
          </div>
        )}
      </section>

      {detailReservation && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setDetailId(null)}
        >
          <div
            className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
              <h3 className="text-lg font-semibold text-stone-900">
                {detailReservation.customer.name}
              </h3>
              <button
                onClick={() => setDetailId(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
              >
                {lang.close}
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                    statusStyles[detailReservation.status] ?? "bg-stone-100 text-stone-600"
                  }`}
                >
                  {statusLabels[detailReservation.status]?.[locale] ?? detailReservation.status}
                </span>
                <span className="text-xs text-stone-500">
                  {lang.createdAt}: {formatDate(detailReservation.createdAt)}
                </span>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-stone-700">{lang.guest}</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-stone-500">{lang.guest}</span>
                    <p className="font-medium text-stone-900">{detailReservation.customer.name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500">Phone</span>
                    <p className="font-medium text-stone-900">{detailReservation.customer.phone}</p>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500">Email</span>
                    <p className="font-medium text-stone-900">
                      {detailReservation.customer.email ?? "\u2014"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500">{lang.source}</span>
                    <p className="font-medium text-stone-900">{detailReservation.source}</p>
                  </div>
                </div>
              </div>

              {!editingDetail ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-stone-700">{lang.editReservation}</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-stone-500">{lang.checkIn}</span>
                      <p className="font-medium text-stone-900">{formatDate(detailReservation.checkIn)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">{lang.checkOut}</span>
                      <p className="font-medium text-stone-900">{formatDate(detailReservation.checkOut)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">{lang.nights}</span>
                      <p className="font-medium text-stone-900">{detailReservation.nights}</p>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">{lang.guests}</span>
                      <p className="font-medium text-stone-900">{detailReservation.guests}</p>
                    </div>
                  </div>
                  {(detailReservation.status === "PAYMENT_PENDING" ||
                    detailReservation.status === "CONFIRMED") && (
                    <button
                      onClick={() => setEditingDetail(true)}
                      className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                    >
                      {lang.edit}
                    </button>
                  )}
                </div>
              ) : (
                <EditReservationForm
                  reservation={detailReservation}
                  formAction={updateFormAction}
                  calcFormAction={calcFormAction}
                  pending={updatePending}
                  calcPending={calcPending}
                  calcState={calcState}
                  lang={lang}
                  onCancel={() => setEditingDetail(false)}
                />
              )}

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-stone-700">{lang.total}</h4>
                <div className="rounded-lg border border-stone-200 p-4 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-stone-600">{lang.totalLabel}</span>
                    <span className="font-medium text-stone-900">
                      {formatCurrency(detailReservation.totalPrice)} {lang.omr}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-stone-600">{lang.depositLabel}</span>
                    <span className="font-medium text-stone-900">
                      {formatCurrency(detailReservation.depositAmount)} {lang.omr}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-stone-100 py-1">
                    <span className="text-stone-600">{lang.remainingLabel}</span>
                    <span className="font-semibold text-stone-900">
                      {formatCurrency(detailReservation.remainingBalance)} {lang.omr}
                    </span>
                  </div>
                </div>
              </div>

              {detailReservation.payments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-stone-700">{lang.paymentHistory}</h4>
                  <div className="space-y-2">
                    {detailReservation.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border border-stone-200 p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-stone-900">{p.type}</p>
                          <p className="text-xs text-stone-500">
                            {p.method}{" "}
                            {p.paidAt ? `\u2022 ${formatDate(p.paidAt)}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-stone-900">
                            {formatCurrency(p.amount)} {lang.omr}
                          </p>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              p.status === "PAID"
                                ? "bg-emerald-50 text-emerald-700"
                                : p.status === "PENDING"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-stone-100 text-stone-600"
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailReservation.notes && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-stone-700">{lang.notes}</h4>
                  <p className="rounded-lg border border-stone-200 p-3 text-sm text-stone-700">
                    {detailReservation.notes}
                  </p>
                </div>
              )}

              {detailReservation.status === "CANCELLED" && (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-4">
                  {detailReservation.cancellationReason && (
                    <div>
                      <span className="text-xs font-medium text-red-600">{lang.cancellationReason}</span>
                      <p className="mt-0.5 text-sm text-stone-700">
                        {detailReservation.cancellationReason}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium text-red-600">{lang.depositRefundable}</span>
                    <p className="mt-0.5 text-sm font-medium text-stone-900">
                      {detailReservation.depositRefundable ? lang.yes : lang.no}
                    </p>
                  </div>
                </div>
              )}

              {!showCancel &&
                (detailReservation.status === "PAYMENT_PENDING" ||
                  detailReservation.status === "CONFIRMED") && (
                  <div className="space-y-2 border-t border-stone-200 pt-4">
                    {detailReservation.status === "PAYMENT_PENDING" && (
                      <button
                        onClick={() => handleMarkDepositPaid(detailReservation.id)}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        {lang.markPaid}
                      </button>
                    )}
                    {detailReservation.status === "CONFIRMED" && (
                      <button
                        onClick={() => handleComplete(detailReservation.id)}
                        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        {lang.complete}
                      </button>
                    )}
                    <button
                      onClick={() => setShowCancel(true)}
                      className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      {lang.cancelReservation}
                    </button>
                  </div>
                )}

              {showCancel && (
                <form
                  action={cancelFormAction}
                  className="space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-4"
                >
                  <input type="hidden" name="reservationId" value={detailReservation.id} />
                  <p className="text-sm font-medium text-stone-700">{lang.cancelHint}</p>
                  <div>
                    <span className="text-xs text-stone-500">{lang.depositRefundable}</span>
                    <p className="text-sm font-medium text-stone-900">
                      {getDaysUntilCheckIn(detailReservation.checkIn) > 7 ? lang.yes : lang.no}
                    </p>
                  </div>
                  <textarea
                    name="reason"
                    rows={2}
                    placeholder={lang.reasonPlaceholder}
                    className={inputClass}
                  />
                  {cancelState.error && (
                    <p className="text-sm text-red-600">{cancelState.error}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={cancelPending}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {cancelPending ? "\u2026" : lang.confirmCancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancel(false)}
                      className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
                    >
                      {lang.cancel}
                    </button>
                  </div>
                </form>
              )}

              {(createState.error || updateState.error) && (
                <p className="text-sm text-red-600">
                  {(createState.error || updateState.error) as string}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateReservationForm({
  customers,
  propertyId,
  formAction,
  pending,
  state,
  lang,
  onCancel,
}: {
  customers: { id: string; name: string; phone: string }[];
  propertyId: string;
  formAction: (payload: FormData) => void;
  pending: boolean;
  state: ActionResult;
  lang: typeof L.en;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        formAction(new FormData(e.currentTarget));
      }}
      className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4"
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <h3 className="text-sm font-semibold text-stone-900">{lang.newReservation}</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.customer}</label>
          <select name="customerId" required className={inputClass}>
            <option value="">{"\u2014"}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.guests}</label>
          <input name="guests" type="number" min="1" required defaultValue={2} className={inputClass} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.checkIn}</label>
          <input name="checkIn" type="date" required className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">{lang.checkOut}</label>
          <input name="checkOut" type="date" required className={inputClass} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">{lang.notes}</label>
        <textarea name="notes" rows={2} className={inputClass} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "\u2026" : lang.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
        >
          {lang.cancel}
        </button>
      </div>
    </form>
  );
}

function EditReservationForm({
  reservation,
  formAction,
  calcFormAction,
  pending,
  calcPending,
  calcState,
  lang,
  onCancel,
}: {
  reservation: SerializedReservation;
  formAction: (payload: FormData) => void;
  calcFormAction: (payload: FormData) => void;
  pending: boolean;
  calcPending: boolean;
  calcState: ActionResult;
  lang: typeof L.en;
  onCancel: () => void;
}) {
  const calcResult = calcState.ok && calcState.data
    ? (calcState.data as { nights: number; totalPrice: number; deposit: number; remainingBalance: number; breakdown: { date: string; season: string; pricePerNight: number }[] })
    : null;

  return (
    <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
      <h4 className="text-sm font-semibold text-stone-900">{lang.editReservation}</h4>

      <form
        action={calcFormAction}
        className="space-y-3"
      >
        <input type="hidden" name="propertyId" value={reservation.propertyId} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">{lang.checkIn}</label>
            <input
              name="checkIn"
              type="date"
              required
              defaultValue={reservation.checkIn.split("T")[0]}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">{lang.checkOut}</label>
            <input
              name="checkOut"
              type="date"
              required
              defaultValue={reservation.checkOut.split("T")[0]}
              className={inputClass}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={calcPending}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-60"
        >
          {calcPending ? "\u2026" : "Recalculate"}
        </button>
      </form>

      {calcResult && (
        <div className="rounded-lg border border-stone-200 p-3 text-xs">
          <div className="flex justify-between py-0.5">
            <span className="text-stone-600">{calcResult.nights} {lang.nightsLabel}</span>
            <span className="font-medium text-stone-900">
              {formatCurrency(calcResult.totalPrice)} {lang.omr}
            </span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-stone-600">{lang.depositLabel}</span>
            <span className="font-medium text-stone-900">
              {formatCurrency(calcResult.deposit)} {lang.omr}
            </span>
          </div>
          <div className="flex justify-between border-t border-stone-100 py-0.5">
            <span className="text-stone-600">{lang.remainingLabel}</span>
            <span className="font-semibold text-stone-900">
              {formatCurrency(calcResult.remainingBalance)} {lang.omr}
            </span>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          formAction(new FormData(e.currentTarget));
        }}
        className="space-y-3"
      >
        <input type="hidden" name="reservationId" value={reservation.id} />
        <input
          type="hidden"
          name="checkIn"
          defaultValue={reservation.checkIn.split("T")[0]}
        />
        <input
          type="hidden"
          name="checkOut"
          defaultValue={reservation.checkOut.split("T")[0]}
        />
        <input type="hidden" name="guests" defaultValue={reservation.guests} />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? "\u2026" : lang.save}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            {lang.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
