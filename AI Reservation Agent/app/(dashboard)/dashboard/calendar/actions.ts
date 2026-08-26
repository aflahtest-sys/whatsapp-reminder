"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createBlockedDate,
  deleteBlockedDate,
} from "@/lib/services/availability";

export type ActionResult = { ok: boolean; error?: string };

const PATH = "/dashboard/calendar";

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

export async function blockDatesAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const propertyId = str(formData.get("propertyId"));
  const startDateStr = str(formData.get("startDate"));
  const endDateStr = str(formData.get("endDate"));
  const reason = str(formData.get("reason")) || null;
  const createdBy = str(formData.get("createdBy")) || "dashboard";

  if (!propertyId || !startDateStr || !endDateStr) {
    return { ok: false, error: "invalid" };
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { ok: false, error: "invalid" };
  }

  const result = await createBlockedDate(
    organizationId,
    propertyId,
    startDate,
    endDate,
    reason,
    createdBy
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(PATH);
  return { ok: true };
}

export async function unblockDateAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const propertyId = str(formData.get("propertyId"));
  const blockId = str(formData.get("blockId"));

  if (!propertyId || !blockId) {
    return { ok: false, error: "invalid" };
  }

  const result = await deleteBlockedDate(organizationId, propertyId, blockId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(PATH);
  return { ok: true };
}
