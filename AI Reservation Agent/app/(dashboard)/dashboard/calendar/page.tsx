import { requireOrgUser } from "@/lib/auth/guards";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { getResortProperty } from "@/lib/services/property";
import { getCalendarMonth } from "@/lib/services/availability";
import type { CalendarDay } from "@/lib/services/availability";
import { CalendarView } from "@/components/calendar/calendar-view";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const session = await requireOrgUser();
  const organizationId = session.user.organizationId;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const params = await searchParams;

  const now = new Date();
  const year = parseInt(params.year ?? String(now.getFullYear()), 10);
  const month = parseInt(params.month ?? String(now.getMonth()), 10);

  let days: CalendarDay[] = [];
  let propertyId: string | null = null;

  if (organizationId) {
    const property = await getResortProperty(organizationId);
    if (property) {
      propertyId = property.id;
      days = await getCalendarMonth(organizationId, property.id, year, month);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{dict.nav.calendar}</h1>
      </div>

      {propertyId ? (
        <CalendarView
          days={days}
          propertyId={propertyId}
          year={year}
          month={month}
          locale={locale}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
          <p className="text-sm font-semibold text-stone-700">{dict.resort.noPropertyTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{dict.resort.noPropertyHint}</p>
        </div>
      )}
    </div>
  );
}
