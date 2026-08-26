import { requireAdmin } from "@/lib/auth/guards";
import { getScopedPrisma } from "@/lib/auth/scoping";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { EmptyState } from "@/components/empty-state";

export default async function AdminHomePage() {
  await requireAdmin();
  const { prisma } = await getScopedPrisma();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      _count: { select: { properties: true, users: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{dict.admin.pageTitle}</h1>
        <p className="mt-1 text-sm text-stone-500">{dict.admin.organizations}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <ul className="divide-y divide-stone-100">
          {organizations.map((organization) => (
            <li key={organization.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-stone-900">{organization.name}</p>
                <p className="text-xs text-stone-500">/{organization.slug}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                  {organization._count.properties} {dict.dashboard.properties.toLowerCase()}
                </span>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600">
                  {organization._count.users} {dict.users}
                </span>
              </div>
            </li>
          ))}
        </ul>
        {organizations.length === 0 ? (
          <EmptyState title={dict.admin.emptyTitle} description={dict.admin.emptyDescription} />
        ) : null}
      </div>
    </div>
  );
}
