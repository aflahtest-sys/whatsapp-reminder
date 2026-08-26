"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import type { CalendarDay } from "@/lib/services/availability";
import { blockDatesAction, unblockDateAction } from "@/app/(dashboard)/dashboard/calendar/actions";

const DAY_HEADERS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_HEADERS_AR = ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"];
const MONTH_NAMES_EN = [
  "January","February","March","April","May","June","July","August","September","October","November","December",
];
const MONTH_NAMES_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

const stateStyles: Record<string, string> = {
  available: "bg-white border-stone-200 text-stone-700 hover:bg-stone-50 hover:shadow-sm",
  booked: "bg-[#E3F2FD] border-blue-200 text-blue-800 hover:bg-blue-100 hover:shadow-sm",
  payment_pending: "bg-[#FFF3E0] border-orange-200 text-orange-800 hover:bg-orange-100 hover:shadow-sm",
  blocked: "bg-[#FFEBEE] border-red-300 text-red-700 hover:bg-red-100 hover:shadow-sm",
  completed: "bg-[#F5F5F5] border-stone-200 text-stone-400 hover:bg-stone-100",
};

const stateLabels: Record<string, { en: string; ar: string }> = {
  available: { en: "Available", ar: "متاح" },
  booked: { en: "Booked", ar: "محجوز" },
  payment_pending: { en: "Pending", ar: "بانتظار الدفع" },
  blocked: { en: "Blocked", ar: "محظور" },
  completed: { en: "Completed", ar: "مكتمل" },
};

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

export function CalendarView({
  days,
  propertyId,
  year,
  month,
  locale,
}: {
  days: CalendarDay[];
  propertyId: string;
  year: number;
  month: number;
  locale: "en" | "ar";
}) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockStartDate, setBlockStartDate] = useState("");
  const [blockEndDate, setBlockEndDate] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const [blockState, blockFormAction, blockPending] = useActionState(blockDatesAction, { ok: false });
  const [, unblockFormAction, unblockPending] = useActionState(unblockDateAction, { ok: false });

  const dayHeaders = locale === "ar" ? DAY_HEADERS_AR : DAY_HEADERS_EN;
  const monthNames = locale === "ar" ? MONTH_NAMES_AR : MONTH_NAMES_EN;

  function navigateMonth(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    router.push(`/dashboard/calendar?year=${newYear}&month=${newMonth}`);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function handleBlockSubmit() {
    if (!blockStartDate || !blockEndDate) return;
    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("startDate", blockStartDate);
    formData.set("endDate", blockEndDate);
    formData.set("reason", blockReason);
    blockFormAction(formData);
  }

  function handleUnblock(blockId: string) {
    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("blockId", blockId);
    unblockFormAction(formData);
    setSelectedDay(null);
  }

  return (
    <>
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigateMonth(-1)} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100">
            ←
          </button>
          <h2 className="text-lg font-semibold text-stone-900">
            {monthNames[month]} {year}
          </h2>
          <button onClick={() => navigateMonth(1)} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100">
            →
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-px bg-stone-200">
          {dayHeaders.map((h) => (
            <div key={h} className="bg-stone-50 py-2 text-center text-xs font-semibold text-stone-500">
              {h}
            </div>
          ))}

          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-white" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const day = days.find((d) => d.date === dateStr);
            const state = day?.state ?? "available";
            const isToday = dateStr === todayStr;

            return (
              <button
                key={dateStr}
                onClick={() => day && setSelectedDay(day)}
                className={`relative border border-stone-200 p-2 text-left text-sm transition ${
                  stateStyles[state]
                } ${isToday ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}
              >
                <span className="font-medium">{dayNum}</span>
                {(day?.reservations.length ?? 0) > 0 && (
                  <span className="mt-0.5 block text-[10px] font-medium opacity-75">
                    {day?.reservations.length} {locale === "ar" ? "حجز" : "bk"}
                  </span>
                )}
                {(day?.blocks.length ?? 0) > 0 && state === "blocked" && (
                  <span className="mt-0.5 block text-[10px] font-medium opacity-75">
                    {locale === "ar" ? "محظور" : "blk"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          {Object.entries(stateLabels).map(([key, labels]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded-full border ${
                key === "available" ? "bg-emerald-200 border-emerald-300" :
                key === "booked" ? "bg-red-200 border-red-300" :
                key === "payment_pending" ? "bg-amber-200 border-amber-300" :
                key === "blocked" ? "bg-stone-300 border-stone-400" :
                "bg-blue-200 border-blue-300"
              }`} />
              <span className="text-stone-600">{locale === "ar" ? labels.ar : labels.en}</span>
            </span>
          ))}
        </div>

        <div className="mt-4">
          <button
            onClick={() => setShowBlockModal(true)}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            + {locale === "ar" ? "حظور تواريخ" : "Block dates"}
          </button>
        </div>
      </div>

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedDay(null)}>
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-stone-900">
                {new Date(selectedDay.date + "T00:00:00").toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                })}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100">
                ✕
              </button>
            </div>

            <div className="mt-3">
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                stateStyles[selectedDay.state]
              }`}>
                {locale === "ar" ? stateLabels[selectedDay.state].ar : stateLabels[selectedDay.state].en}
              </span>
            </div>

            {selectedDay.reservations.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-semibold text-stone-700">
                  {locale === "ar" ? "الحجوزات" : "Reservations"}
                </h4>
                {selectedDay.reservations.map((r) => (
                  <div key={r.id} className="rounded-lg border border-stone-200 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-stone-900">
                        {r.customerName ?? (locale === "ar" ? "ضيف" : "Guest")}
                      </span>
                      <span className="text-xs text-stone-500">{r.guests} {locale === "ar" ? "ضيف" : "guests"}</span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {r.checkIn} → {r.checkOut}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {selectedDay.blocks.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-semibold text-stone-700">
                  {locale === "ar" ? "الحظورات" : "Blocks"}
                </h4>
                {selectedDay.blocks.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-stone-200 p-3 text-sm">
                    <div>
                      <p className="font-medium text-stone-900">
                        {b.startDate} → {b.endDate}
                      </p>
                      {b.reason && (
                        <p className="mt-0.5 text-xs text-stone-500">{b.reason}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleUnblock(b.id)}
                      disabled={unblockPending}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {locale === "ar" ? "إزالة" : "Unblock"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedDay.reservations.length === 0 && selectedDay.blocks.length === 0 && (
              <p className="mt-4 text-sm text-stone-500">
                {locale === "ar" ? "لا توجد حجوزات أو حظورات" : "No reservations or blocks"}
              </p>
            )}
          </div>
        </div>
      )}

      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowBlockModal(false)}>
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-stone-900">
              {locale === "ar" ? "حظور تواريخ" : "Block date range"}
            </h3>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  {locale === "ar" ? "من" : "Start date"}
                </label>
                <input type="date" value={blockStartDate} onChange={(e) => setBlockStartDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  {locale === "ar" ? "إلى" : "End date (exclusive)"}
                </label>
                <input type="date" value={blockEndDate} onChange={(e) => setBlockEndDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  {locale === "ar" ? "السبب" : "Reason (optional)"}
                </label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder={locale === "ar" ? "مثال: استخدام المالك" : "e.g. Owner use"}
                  className={inputClass}
                />
              </div>
            </div>

            {blockState.error && (
              <p className="mt-2 text-sm text-red-600">
                {blockState.error === "invalid_dates"
                  ? (locale === "ar" ? "تواريخ غير صالحة" : "Invalid dates")
                  : (locale === "ar" ? "حدث خطأ" : "An error occurred")}
              </p>
            )}
            {blockState.ok && (
              <p className="mt-2 text-sm text-emerald-600">
                {locale === "ar" ? "تم الحفظ" : "Saved"}
              </p>
            )}

            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={handleBlockSubmit}
                disabled={blockPending || !blockStartDate || !blockEndDate}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {blockPending ? "…" : (locale === "ar" ? "حفظ" : "Save")}
              </button>
              <button
                onClick={() => setShowBlockModal(false)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                {locale === "ar" ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
