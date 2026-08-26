import { requireOrgUser } from "@/lib/auth/guards";
import { getScopedPrisma } from "@/lib/auth/scoping";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { getDashboardMetrics } from "@/lib/services/dashboard-metrics";
import { Scorecard } from "@/components/dashboard/scorecard";

export default async function DashboardHomePage() {
  const session = await requireOrgUser();
  const { prisma, organizationId } = await getScopedPrisma();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const organization = organizationId
    ? await prisma.organization.findUnique({ where: { id: organizationId } })
    : null;

  const property = organizationId
    ? await prisma.property.findFirst({ where: { organizationId } })
    : null;

  let metrics = {
    revenueThisMonth: 0,
    currency: "OMR",
    occupancyPercent: 0,
    nightsBooked: 0,
    nightsTotal: 30,
    pendingPayments: 0,
    blockedDays: 0,
  };

  if (organizationId) {
    try {
      metrics = await getDashboardMetrics(organizationId);
    } catch {
      // Metrics query failed — use defaults
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">
          {dict.dashboard.welcome}, {session.user.name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {property?.name ?? organization?.name} · {dict.dashboard.pageTitle}
        </p>
      </div>

      <Scorecard
        revenueThisMonth={metrics.revenueThisMonth}
        currency={metrics.currency}
        occupancyPercent={metrics.occupancyPercent}
        nightsBooked={metrics.nightsBooked}
        nightsTotal={metrics.nightsTotal}
        pendingPayments={metrics.pendingPayments}
        blockedDays={metrics.blockedDays}
        locale={locale}
      />

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-900">
          {locale === "ar" ? "الملخص" : "Summary"}
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          {locale === "ar"
            ? "لوحة التحكم الخاصة بك جاهزة. استخدم القائمة_side للتنقل بين الحجوزات والتقويم والإعدادات."
            : "Your dashboard is ready. Use the sidebar to navigate between Reservations, Calendar, and Settings."}
        </p>
      </div>
    </div>
  );
}
