"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  changePriority,
  calculateBookingPrice,
} from "@/lib/services/pricing";

export type ActionResult = { ok: boolean; error?: string; data?: unknown };

const PATH = "/dashboard/pricing";

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

function decimalStr(value: FormDataEntryValue | null): string {
  const parsed = parseFloat(str(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : "0.00";
}

function intValue(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = parseInt(str(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function createPricingRuleAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const propertyId = str(formData.get("propertyId"));
  const name = str(formData.get("name"));
  const pricePerNight = decimalStr(formData.get("pricePerNight"));
  const startDateStr = str(formData.get("startDate"));
  const endDateStr = str(formData.get("endDate"));
  const priority = intValue(formData.get("priority"), 5);
  const isDefault = formData.get("isDefault") === "on";
  const isActive = formData.get("isActive") === "on";
  const isRecurringHijri = formData.get("isRecurringHijri") === "on";

  if (!propertyId || !name || !startDateStr || !endDateStr) {
    return { ok: false, error: "invalid" };
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { ok: false, error: "invalid" };
  }

  const result = await createPricingRule(organizationId, propertyId, {
    name,
    pricePerNight,
    startDate,
    endDate,
    priority,
    isDefault,
    isActive,
    isRecurringHijri,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(PATH);
  return { ok: true };
}

export async function updatePricingRuleAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const propertyId = str(formData.get("propertyId"));
  const ruleId = str(formData.get("ruleId"));
  const name = str(formData.get("name"));
  const pricePerNight = decimalStr(formData.get("pricePerNight"));
  const startDateStr = str(formData.get("startDate"));
  const endDateStr = str(formData.get("endDate"));
  const priority = intValue(formData.get("priority"), 5);
  const isDefault = formData.get("isDefault") === "on";
  const isActive = formData.get("isActive") === "on";
  const isRecurringHijri = formData.get("isRecurringHijri") === "on";

  if (!propertyId || !ruleId || !name || !startDateStr || !endDateStr) {
    return { ok: false, error: "invalid" };
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { ok: false, error: "invalid" };
  }

  const result = await updatePricingRule(organizationId, propertyId, ruleId, {
    name,
    pricePerNight,
    startDate,
    endDate,
    priority,
    isDefault,
    isActive,
    isRecurringHijri,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(PATH);
  return { ok: true };
}

export async function deletePricingRuleAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const propertyId = str(formData.get("propertyId"));
  const ruleId = str(formData.get("ruleId"));

  if (!propertyId || !ruleId) return { ok: false, error: "invalid" };

  const result = await deletePricingRule(organizationId, propertyId, ruleId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(PATH);
  return { ok: true };
}

export async function changePriorityAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const propertyId = str(formData.get("propertyId"));
  const ruleId = str(formData.get("ruleId"));
  const direction = str(formData.get("direction")) as "up" | "down";

  if (!propertyId || !ruleId || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "invalid" };
  }

  const result = await changePriority(organizationId, propertyId, ruleId, direction);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(PATH);
  return { ok: true };
}

export async function calculatePriceAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireOrgScope();
    const propertyId = str(formData.get("propertyId"));
    const checkInStr = str(formData.get("checkIn"));
    const checkOutStr = str(formData.get("checkOut"));

    if (!propertyId || !checkInStr || !checkOutStr) {
      return { ok: false, error: "invalid" };
    }

    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return { ok: false, error: "invalid" };
    }

    const result = await calculateBookingPrice(propertyId, checkIn, checkOut);
    if (!result.ok) return { ok: false, error: result.error };

    return { ok: true, data: result.data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown_error" };
  }
}
