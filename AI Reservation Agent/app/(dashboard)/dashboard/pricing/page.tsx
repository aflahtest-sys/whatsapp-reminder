import { requireOrgUser } from "@/lib/auth/guards";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { getResortProperty } from "@/lib/services/property";
import { listPricingRules } from "@/lib/services/pricing";
import { PricingManager } from "@/components/pricing/pricing-manager";

export default async function PricingPage() {
  const session = await requireOrgUser();
  const organizationId = session.user.organizationId;
  const locale = await getLocale();
  const dict = getDictionary(locale);

  let propertyId: string | null = null;
  let rules: { id: string; name: string; pricePerNight: string; startDate: string; endDate: string; priority: number; isDefault: boolean; isActive: boolean; isRecurringHijri: boolean }[] = [];

  if (organizationId) {
    const property = await getResortProperty(organizationId);
    if (property) {
      propertyId = property.id;
      const dbRules = await listPricingRules(property.id);
      rules = dbRules.map((r) => ({
        id: r.id,
        name: r.name,
        pricePerNight: r.pricePerNight.toString(),
        startDate: r.startDate ? new Date(r.startDate).toISOString().split("T")[0] : "",
        endDate: r.endDate ? new Date(r.endDate).toISOString().split("T")[0] : "",
        priority: r.priority,
        isDefault: r.isDefault,
        isActive: r.isActive,
        isRecurringHijri: r.isRecurringHijri,
      }));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{dict.nav.pricing}</h1>
      </div>

      {propertyId ? (
        <PricingManager
          propertyId={propertyId}
          rules={rules}
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
