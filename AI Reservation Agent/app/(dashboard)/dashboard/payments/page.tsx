import { requireOrgUser } from "@/lib/auth/guards";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";

export default async function PaymentsPage() {
  await requireOrgUser();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{dict.payments.title}</h1>
        <p className="mt-1 text-sm text-stone-500">{dict.payments.subtitle}</p>
      </div>

      <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
        <p className="text-sm font-semibold text-stone-700">{dict.payments.comingSoon}</p>
        <p className="mt-1 text-sm text-stone-500">{dict.payments.comingSoonHint}</p>
      </div>
    </div>
  );
}
