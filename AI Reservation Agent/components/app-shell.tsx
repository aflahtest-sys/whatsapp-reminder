import { LocaleToggle } from "@/components/locale-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { NavLink } from "@/components/nav-link";
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";
import type { NavItem } from "@/lib/navigation";

type AppShellProps = {
  brand: string;
  userName: string;
  roleLabel: string;
  locale: Locale;
  navItems: NavItem[];
  children: React.ReactNode;
};

export function AppShell({ brand, userName, roleLabel, locale, navItems, children }: AppShellProps) {
  const dict = getDictionary(locale);

  return (
    <div className="min-h-screen bg-stone-50">
      <aside className="fixed inset-y-0 start-0 z-20 hidden w-64 flex-col bg-emerald-950 md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-emerald-900 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold text-white">
            Q
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{brand}</p>
            <p className="truncate text-xs text-emerald-300/70">{dict.appName}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={dict.nav[item.labelKey]} />
          ))}
        </nav>
        <div className="border-t border-emerald-900 p-3">
          <p className="px-3 text-sm font-medium text-white">{userName}</p>
          <p className="px-3 text-xs text-emerald-300/70">{roleLabel}</p>
        </div>
      </aside>

      <div className="md:ps-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-stone-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white md:hidden">
              Q
            </div>
            <span className="truncate text-sm font-semibold text-stone-800">{brand}</span>
          </div>
          <div className="flex items-center gap-2">
            <LocaleToggle locale={locale} />
            <SignOutButton label={dict.signOut} />
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-stone-200 bg-white px-3 py-2 md:hidden">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={dict.nav[item.labelKey]} />
          ))}
        </nav>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
