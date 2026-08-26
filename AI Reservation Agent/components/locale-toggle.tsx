"use client";

import type { Locale } from "@/lib/i18n/dictionaries";

export function LocaleToggle({ locale }: { locale: Locale }) {
  const target: Locale = locale === "ar" ? "en" : "ar";
  const label = target === "ar" ? "العربية" : "English";

  function switchLocale() {
    document.cookie = `locale=${target}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
    >
      {label}
    </button>
  );
}
