import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Session } from "next-auth";

export async function requireUser(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireOrgUser(): Promise<Session> {
  const session = await requireUser();
  if (session.user.role === "PLATFORM_ADMIN") redirect("/admin");
  if (!session.user.organizationId) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (session.user.role !== "PLATFORM_ADMIN") redirect("/dashboard");
  return session;
}
