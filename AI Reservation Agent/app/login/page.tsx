import { Suspense } from "react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-800 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
            Q
          </div>
          <h1 className="text-xl font-bold text-stone-900">{dict.login.title}</h1>
          <p className="mt-1 text-sm text-stone-500">{dict.login.subtitle}</p>
        </div>
        <Suspense>
          <LoginForm locale={locale} />
        </Suspense>
        <p className="mt-6 border-t border-stone-100 pt-4 text-center text-xs text-stone-400">
          {dict.login.devCredentialsNote}
        </p>
      </div>
    </div>
  );
}
