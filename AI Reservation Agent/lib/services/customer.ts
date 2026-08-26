import { prisma } from "@/lib/db";

export type ServiceResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function listCustomers(organizationId: string, search?: string) {
  const where: Record<string, unknown> = { organizationId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { reservations: true } } },
  });

  return customers;
}

export async function getCustomer(
  organizationId: string,
  customerId: string
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    include: {
      reservations: {
        orderBy: { checkIn: "desc" },
        include: { _count: { select: { payments: true } } },
      },
    },
  });

  return customer ?? null;
}

export async function createCustomer(
  organizationId: string,
  data: {
    name: string;
    phone: string;
    email?: string;
    preferredLanguage?: string;
    notes?: string;
  }
): Promise<ServiceResult> {
  try {
    await prisma.customer.create({
      data: { ...data, organizationId },
    });
    return { ok: true };
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      return { ok: false, error: "duplicate_phone" };
    }
    throw e;
  }
}

export async function updateCustomer(
  organizationId: string,
  customerId: string,
  data: {
    name?: string;
    phone?: string;
    email?: string;
    preferredLanguage?: string;
    notes?: string;
  }
): Promise<ServiceResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: { id: true },
  });

  if (!customer) {
    return { ok: false, error: "not_found" };
  }

  try {
    await prisma.customer.update({
      where: { id: customerId },
      data,
    });
    return { ok: true };
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      return { ok: false, error: "duplicate_phone" };
    }
    throw e;
  }
}

export async function deleteCustomer(
  organizationId: string,
  customerId: string
): Promise<ServiceResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    include: { _count: { select: { reservations: true } } },
  });

  if (!customer) {
    return { ok: false, error: "not_found" };
  }

  if (customer._count.reservations > 0) {
    return { ok: false, error: "has_reservations" };
  }

  await prisma.customer.delete({ where: { id: customerId } });
  return { ok: true };
}
