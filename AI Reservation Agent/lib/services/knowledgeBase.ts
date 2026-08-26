import { prisma } from "@/lib/db";
import type { KnowledgeBaseEntry, KnowledgeType } from "@/generated/prisma/client";
import { propertyBelongsToOrg } from "@/lib/services/property";

export type KnowledgeEntryData = {
  type: KnowledgeType;
  question: string | null;
  contentEn: string;
  contentAr: string;
  isActive: boolean;
  sortOrder: number;
};

export type ServiceResult<TData = undefined> =
  | { ok: true; data?: TData }
  | { ok: false; error: string };

const KB_TYPES: KnowledgeType[] = ["FACILITY", "POLICY", "FAQ", "LOCATION", "CONTACT", "OTHER"];

export function isKnowledgeType(value: string): value is KnowledgeType {
  return (KB_TYPES as string[]).includes(value);
}

export async function listKnowledgeEntries(propertyId: string) {
  return prisma.knowledgeBaseEntry.findMany({
    where: { propertyId },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "asc" }],
  });
}

export async function createKnowledgeEntry(
  organizationId: string,
  propertyId: string,
  data: KnowledgeEntryData
): Promise<ServiceResult<KnowledgeBaseEntry>> {
  if (!(await propertyBelongsToOrg(organizationId, propertyId))) {
    return { ok: false, error: "not_found" };
  }
  const entry = await prisma.knowledgeBaseEntry.create({
    data: {
      propertyId,
      type: data.type,
      question: data.question,
      contentEn: data.contentEn,
      contentAr: data.contentAr,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    },
  });
  return { ok: true, data: entry };
}

export async function updateKnowledgeEntry(
  organizationId: string,
  propertyId: string,
  entryId: string,
  data: KnowledgeEntryData
): Promise<ServiceResult> {
  if (!(await propertyBelongsToOrg(organizationId, propertyId))) {
    return { ok: false, error: "not_found" };
  }
  const entry = await prisma.knowledgeBaseEntry.findFirst({
    where: { id: entryId, propertyId },
    select: { id: true },
  });
  if (!entry) return { ok: false, error: "not_found" };

  await prisma.knowledgeBaseEntry.update({
    where: { id: entryId },
    data: {
      type: data.type,
      question: data.question,
      contentEn: data.contentEn,
      contentAr: data.contentAr,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    },
  });
  return { ok: true };
}

export async function deleteKnowledgeEntry(
  organizationId: string,
  propertyId: string,
  entryId: string
): Promise<ServiceResult> {
  if (!(await propertyBelongsToOrg(organizationId, propertyId))) {
    return { ok: false, error: "not_found" };
  }
  const entry = await prisma.knowledgeBaseEntry.findFirst({
    where: { id: entryId, propertyId },
    select: { id: true },
  });
  if (!entry) return { ok: false, error: "not_found" };

  await prisma.knowledgeBaseEntry.delete({ where: { id: entryId } });
  return { ok: true };
}

/**
 * AI-facing fetch (architecture.md §8): returns the resort info + active
 * knowledge entries as plain data for the agent (Phase 5+). Never exposes
 * internal ids or inactive entries.
 */
export async function getAiKnowledge(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      name: true,
      description: true,
      addressText: true,
      maxGuests: true,
      bedrooms: true,
      beds: true,
      bathrooms: true,
      facilities: true,
      checkInTime: true,
      checkOutTime: true,
      currency: true,
      depositAmount: true,
      cancellationRefundDays: true,
    },
  });
  if (!property) return null;

  const entries = await prisma.knowledgeBaseEntry.findMany({
    where: { propertyId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "asc" }],
    select: {
      type: true,
      question: true,
      contentEn: true,
      contentAr: true,
    },
  });

  return { property, entries };
}
