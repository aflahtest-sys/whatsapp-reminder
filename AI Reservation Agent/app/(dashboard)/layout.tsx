import { requireOrgUser } from "@/lib/auth/guards";
import { getScopedPrisma } from "@/lib/auth/scoping";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { dashboardNav } from "@/lib/navigation";
import { AppShell } from "@/components/app-shell";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireOrgUser();
  const { prisma, organizationId } = await getScopedPrisma();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const organization = organizationId
    ? await prisma.organization.findUnique({ where: { id: organizationId } })
    : null;

  return (
    <AppShell
      brand={organization?.name ?? "Queens Garden"}
      userName={session.user.name ?? session.user.email ?? ""}
      roleLabel={dict.role[session.user.role]}
      locale={locale}
      navItems={dashboardNav}
    >
      {children}
    </AppShell>
  );
}
