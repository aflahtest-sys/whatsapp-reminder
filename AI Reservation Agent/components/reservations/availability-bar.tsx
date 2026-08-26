"use client";

import { useState } from "react";

type DayStatus = {
  date: string;
  status: "available" | "booked" | "payment_pending" | "blocked";
};

type AvailabilityBarProps = {
  days: DayStatus[];
  locale: "en" | "ar";
  onDayClick?: (date: string, status: string) => void;
};

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const STATUS_COLOR: Record<DayStatus["status"], string> = {
  available: "bg-emerald-400",
  booked: "bg-amber-400",
  payment_pending: "bg-orange-400",
  blocked: "bg-red-400",
};

const STATUS_LABEL_EN: Record<DayStatus["status"], string> = {
  available: "Available",
  booked: "Booked",
  payment_pending: "Payment Pending",
  blocked: "Blocked",
};

const STATUS_LABEL_AR: Record<DayStatus["status"], string> = {
  available: "متاح",
  booked: "محجوز",
  payment_pending: "بانتظار الدفع",
  blocked: "محظور",
};

function formatDate(dateStr: string, locale: "en" | "ar"): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = locale === "ar" ? AR_MONTHS : EN_MONTHS;
  const monthName = months[month - 1];

  if (locale === "ar") {
    return `${day} ${monthName} ${year}`;
  }
  return `${monthName} ${day}, ${year}`;
}

function buildTitle(dateStr: string, status: DayStatus["status"], locale: "en" | "ar"): string {
  const formattedDate = formatDate(dateStr, locale);
  const label = locale === "ar" ? STATUS_LABEL_AR[status] : STATUS_LABEL_EN[status];
  return `${formattedDate} — ${label}`;
}

export function AvailabilityBar({ days, locale, onDayClick }: AvailabilityBarProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 overflow-x-auto">
        {days.map((day, idx) => (
          <button
            key={day.date}
            type="button"
            title={buildTitle(day.date, day.status, locale)}
            className={`h-3 w-3 rounded-full ${STATUS_COLOR[day.status]} cursor-pointer transition-transform duration-150 hover:scale-130`}
            style={hoveredIdx === idx ? { transform: "scale(1.3)" } : undefined}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => onDayClick?.(day.date, day.status)}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 text-stone-500" style={{ fontSize: 11 }}>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          {locale === "ar" ? "متاح" : "Available"}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
          {locale === "ar" ? "محجوز" : "Booked"}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
          {locale === "ar" ? "بانتظار الدفع" : "Payment Pending"}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
          {locale === "ar" ? "محظور" : "Blocked"}
        </span>
      </div>
    </div>
  );
}
