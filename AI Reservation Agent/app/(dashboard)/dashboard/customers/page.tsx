import { requireOrgUser } from "@/lib/auth/guards";
import { listCustomers } from "@/lib/services/customer";
import { getResortProperty } from "@/lib/services/property";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { CustomerList } from "@/components/customers/customer-list";

export default async function CustomersPage() {
  const session = await requireOrgUser();
  const organizationId = session.user.organizationId;
  const locale = await getLocale();
  const dict = getDictionary(locale);

  let customers: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    preferredLanguage: string;
    notes: string | null;
    _count: { reservations: number };
  }[] = [];
  let propertyId: string | null = null;

  if (organizationId) {
    const property = await getResortProperty(organizationId);
    if (property) {
      propertyId = property.id;
    }
    const dbCustomers = await listCustomers(organizationId);
    customers = dbCustomers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      preferredLanguage: c.preferredLanguage,
      notes: c.notes,
      _count: c._count,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{dict.nav.customers}</h1>
      </div>

      {propertyId ? (
        <CustomerList customers={customers} locale={locale} />
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
          <p className="text-sm font-semibold text-stone-700">{dict.resort.noPropertyTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{dict.resort.noPropertyHint}</p>
        </div>
      )}
    </div>
  );
}
