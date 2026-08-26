"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  updateProperty,
  syncPropertyPhotos,
  type FacilityInput,
  type PhotoInput,
} from "@/lib/services/property";
import {
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  isKnowledgeType,
  type KnowledgeEntryData,
} from "@/lib/services/knowledgeBase";
import { isFacility } from "@/lib/facilities";

export type ActionResult = { ok: boolean; error?: string };

const PATH = "/dashboard/resort-info";

async function requireOrgScope(): Promise<string> {
  const session = await auth();
  if (!session?.user || session.user.role === "PLATFORM_ADMIN") {
    redirect("/login");
  }
  if (!session.user.organizationId) {
    redirect("/login");
  }
  return session.user.organizationId;
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function intValue(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = parseInt(str(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decimalValue(value: FormDataEntryValue | null): string {
  const parsed = parseFloat(str(value));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function timeValue(value: FormDataEntryValue | null): string | null {
  const raw = str(value);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : null;
}

function parseFacilities(raw: FormDataEntryValue | null): FacilityInput[] | null {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter(isFacility)
      .map((f) => ({
        key: f.key || `facility-${Math.random().toString(36).slice(2, 8)}`,
        label_en: f.label_en,
        label_ar: f.label_ar,
        icon: f.icon,
      }));
  } catch {
    return null;
  }
}

function parsePhotos(raw: FormDataEntryValue | null): PhotoInput[] | null {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((p): p is { url: string; altText?: string } => {
        if (!p || typeof p !== "object") return false;
        return typeof (p as { url?: unknown }).url === "string";
      })
      .map((p) => ({ url: p.url.trim(), altText: typeof p.altText === "string" ? p.altText : "" }))
      .filter((p) => p.url !== "");
  } catch {
    return null;
  }
}

export async function updatePropertyAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const propertyId = str(formData.get("propertyId"));

  if (!propertyId) return { ok: false, error: "invalid" };

  const name = str(formData.get("name"));
  const description = str(formData.get("description"));
  const addressText = str(formData.get("addressText"));
  const mapsUrl = str(formData.get("mapsUrl")) || null;
  const checkInTime = timeValue(formData.get("checkInTime"));
  const checkOutTime = timeValue(formData.get("checkOutTime"));
  const maxGuests = intValue(formData.get("maxGuests"));
  const bedrooms = intValue(formData.get("bedrooms"));
  const beds = intValue(formData.get("beds"));
  const bathrooms = intValue(formData.get("bathrooms"));
  const minStayNights = intValue(formData.get("minStayNights"), 1);
  const allowSameDayBooking = formData.get("allowSameDayBooking") === "on";
  const depositAmount = decimalValue(formData.get("depositAmount"));
  const cancellationRefundDays = intValue(formData.get("cancellationRefundDays"));
  const facilities = parseFacilities(formData.get("facilitiesJson"));
  const photos = parsePhotos(formData.get("imagesJson"));

  if (
    !name ||
    !description ||
    !addressText ||
    !checkInTime ||
    !checkOutTime ||
    maxGuests < 1 ||
    maxGuests > 100 ||
    bedrooms < 0 ||
    beds < 0 ||
    bathrooms < 0 ||
    minStayNights < 1 ||
    cancellationRefundDays < 0 ||
    facilities === null ||
    photos === null
  ) {
    return { ok: false, error: "invalid" };
  }

  const result = await updateProperty(organizationId, propertyId, {
    name,
    description,
    addressText,
    mapsUrl,
    checkInTime,
    checkOutTime,
    maxGuests,
    bedrooms,
    beds,
    bathrooms,
    minStayNights,
    allowSameDayBooking,
    depositAmount,
    cancellationRefundDays,
    facilities,
  });
  if (!result.ok) return result;

  const photoResult = await syncPropertyPhotos(organizationId, propertyId, photos);
  if (!photoResult.ok) return photoResult;

  revalidatePath(PATH);
  return { ok: true };
}

function parseKnowledgeEntry(formData: FormData): { ok: true; data: KnowledgeEntryData } | { ok: false } {
  const type = str(formData.get("type"));
  const question = str(formData.get("question")) || null;
  const contentEn = str(formData.get("contentEn"));
  const contentAr = str(formData.get("contentAr"));
  const isActive = formData.get("isActive") === "on";
  const sortOrder = intValue(formData.get("sortOrder"));

  if (!isKnowledgeType(type)) return { ok: false };

  return {
    ok: true,
    data: { type, question, contentEn, contentAr, isActive, sortOrder },
  };
}

export async function createKnowledgeEntryAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const propertyId = str(formData.get("propertyId"));
  const parsed = parseKnowledgeEntry(formData);

  if (!parsed.ok) return { ok: false, error: "invalid" };
  const { type, question, contentEn, contentAr, isActive, sortOrder } = parsed.data;

  if (!propertyId || (!contentEn && !contentAr)) {
    return { ok: false, error: "invalid" };
  }
  if (type === "FAQ" && !question) {
    return { ok: false, error: "invalid" };
  }

  const result = await createKnowledgeEntry(organizationId, propertyId, {
    type,
    question,
    contentEn,
    contentAr,
    isActive,
    sortOrder,
  });
  if (!result.ok) return result;

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateKnowledgeEntryAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const propertyId = str(formData.get("propertyId"));
  const entryId = str(formData.get("entryId"));
  const parsed = parseKnowledgeEntry(formData);

  if (!parsed.ok) return { ok: false, error: "invalid" };
  const { type, question, contentEn, contentAr, isActive, sortOrder } = parsed.data;

  if (!propertyId || !entryId || (!contentEn && !contentAr)) {
    return { ok: false, error: "invalid" };
  }

  const result = await updateKnowledgeEntry(organizationId, propertyId, entryId, {
    type,
    question,
    contentEn,
    contentAr,
    isActive,
    sortOrder,
  });
  if (!result.ok) return result;

  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteKnowledgeEntryAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const propertyId = str(formData.get("propertyId"));
  const entryId = str(formData.get("entryId"));

  if (!propertyId || !entryId) return { ok: false, error: "invalid" };

  const result = await deleteKnowledgeEntry(organizationId, propertyId, entryId);
  if (!result.ok) return result;

  revalidatePath(PATH);
  return { ok: true };
}
