"use client";

import { TrendingUp, CalendarDays, Clock, Lock } from "lucide-react";

type ScorecardProps = {
  revenueThisMonth: number;
  currency: string;
  occupancyPercent: number;
  nightsBooked: number;
  nightsTotal: number;
  pendingPayments: number;
  blockedDays: number;
  locale: "en" | "ar";
};

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-OM" : "en-OM").format(
    value
  );
}

function formatCurrency(
  amount: number,
  currency: string,
  locale: string
): string {
  const formatted = new Intl.NumberFormat(
    locale === "ar" ? "ar-OM" : "en-OM",
    { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  ).format(amount);
  return `${currency} ${formatted}`;
}

export function Scorecard(props: ScorecardProps) {
  const { locale } = props;

  const revenueMetric = formatCurrency(
    props.revenueThisMonth,
    props.currency,
    locale
  );
  const occupancyMetric = `${props.occupancyPercent}%`;
  const occupancyLabel =
    locale === "ar"
      ? `الإشغال — ${formatNumber(props.nightsBooked, locale)}/${formatNumber(props.nightsTotal, locale)} ليلة`
      : `Occupancy — ${props.nightsBooked}/${props.nightsTotal} nights`;
  const pendingMetric = formatCurrency(
    props.pendingPayments,
    props.currency,
    locale
  );
  const blockedMetric =
    locale === "ar"
      ? `${formatNumber(props.blockedDays, locale)} يوم`
      : `${props.blockedDays} days`;

  const cards: {
    icon: typeof TrendingUp;
    color: string;
    bg: string;
    metric: string;
    label: string;
  }[] = [
    {
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-50/50",
      metric: revenueMetric,
      label:
        locale === "ar" ? "إيرادات هذا الشهر" : "Revenue This Month",
    },
    {
      icon: CalendarDays,
      color: "text-blue-500",
      bg: "bg-blue-50/50",
      metric: occupancyMetric,
      label: occupancyLabel,
    },
    {
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-50/50",
      metric: pendingMetric,
      label: locale === "ar" ? "مدفوعات معلقة" : "Pending Payments",
    },
    {
      icon: Lock,
      color: "text-red-500",
      bg: "bg-red-50/50",
      metric: blockedMetric,
      label:
        locale === "ar"
          ? "أيام محظورة (30 يوم)"
          : "Blocked Days (Next 30)",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-stone-200 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-3xl font-bold text-stone-900">
                  {card.metric}
                </p>
                <p className="mt-1 text-sm text-stone-500">{card.label}</p>
              </div>
              <div className={`rounded-lg p-2 ${card.bg}`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
