import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { EmptyState } from "@/components/empty-state";

export async function PhasePlaceholder({
  phase,
  titleKey,
}: {
  phase: number;
  titleKey: string;
}) {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{dict.nav[titleKey]}</h1>
      </div>
      <EmptyState
        title={dict.nav[titleKey]}
        description={dict.phaseComingSoon.replace("{phase}", String(phase))}
      />
    </div>
  );
}
