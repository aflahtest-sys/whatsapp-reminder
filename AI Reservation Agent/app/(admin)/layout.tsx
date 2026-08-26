import { requireAdmin } from "@/lib/auth/guards";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { adminNav } from "@/lib/navigation";
import { AppShell } from "@/components/app-shell";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAdmin();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <AppShell
      brand="Queens Garden AI"
      userName={session.user.name ?? session.user.email ?? ""}
      roleLabel={dict.role[session.user.role]}
      locale={locale}
      navItems={adminNav}
    >
      {children}
    </AppShell>
  );
}
