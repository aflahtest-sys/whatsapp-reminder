import { requireOrgUser } from "@/lib/auth/guards";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { getResortProperty } from "@/lib/services/property";
import { listKnowledgeEntries } from "@/lib/services/knowledgeBase";
import { PropertyForm } from "@/components/resort/property-form";
import { KnowledgeBase } from "@/components/resort/knowledge-base";
import type { ClientKnowledgeEntry, ClientProperty } from "@/components/resort/types";

export default async function ResortInfoPage() {
  const session = await requireOrgUser();
  const organizationId = session.user.organizationId;
  const locale = await getLocale();
  const dict = getDictionary(locale);

  if (!organizationId) return null;

  const property = await getResortProperty(organizationId);
  const entries = property ? await listKnowledgeEntries(property.id) : [];

  let clientProperty: ClientProperty | null = null;
  if (property) {
    clientProperty = {
      id: property.id,
      name: property.name,
      description: property.description,
      addressText: property.addressText,
      mapsUrl: property.mapsUrl,
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
      maxGuests: property.maxGuests,
      bedrooms: property.bedrooms,
      beds: property.beds,
      bathrooms: property.bathrooms,
      minStayNights: property.minStayNights,
      allowSameDayBooking: property.allowSameDayBooking,
      depositAmount: property.depositAmount.toString(),
      cancellationRefundDays: property.cancellationRefundDays,
      facilities: property.facilities as ClientProperty["facilities"],
      images: property.images.map((image) => ({
        id: image.id,
        url: image.url,
        altText: image.altText,
      })),
    };
  }

  const clientEntries: ClientKnowledgeEntry[] = entries.map((entry) => ({
    id: entry.id,
    type: entry.type,
    question: entry.question,
    contentEn: entry.contentEn,
    contentAr: entry.contentAr,
    isActive: entry.isActive,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{dict.resort.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">{dict.resort.subtitle}</p>
      </div>

      {clientProperty ? (
        <>
          <PropertyForm property={clientProperty} locale={locale} dict={dict} />
          <KnowledgeBase propertyId={clientProperty.id} entries={clientEntries} dict={dict} />
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
          <p className="text-sm font-semibold text-stone-700">{dict.resort.noPropertyTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{dict.resort.noPropertyHint}</p>
        </div>
      )}
    </div>
  );
}
