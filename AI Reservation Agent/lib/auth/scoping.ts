import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * Returns a Prisma handle whose organization scope always comes from the
 * authenticated session — never from client-supplied parameters.
 *
 * - Platform admins get `organizationId: null` (cross-tenant access).
 * - Org users get the session's `organizationId`; every org-scoped query
 *   must be filtered with it.
 */
export type ScopedPrisma = {
  prisma: typeof prisma;
  organizationId: string | null;
  isAdmin: boolean;
};

export async function getScopedPrisma(): Promise<ScopedPrisma> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role === "PLATFORM_ADMIN") {
    return { prisma, organizationId: null, isAdmin: true };
  }

  const organizationId = session.user.organizationId;
  if (!organizationId) redirect("/login");

  return { prisma, organizationId, isAdmin: false };
}
