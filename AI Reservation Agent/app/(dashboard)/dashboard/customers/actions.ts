"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/services/customer";

export type ActionResult = { ok: boolean; error?: string; data?: unknown };

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

const PATH = "/dashboard/customers";

export async function getCustomersAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const organizationId = await requireOrgScope();
    const search = str(formData.get("search")) || undefined;
    const customers = await listCustomers(organizationId, search);
    return { ok: true, data: customers };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown_error" };
  }
}

export async function createCustomerAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const name = str(formData.get("name"));
  const phone = str(formData.get("phone"));
  const email = str(formData.get("email")) || undefined;
  const preferredLanguage = str(formData.get("preferredLanguage")) || undefined;
  const notes = str(formData.get("notes")) || undefined;

  if (!name || !phone) {
    return { ok: false, error: "Name and phone are required" };
  }

  const result = await createCustomer(organizationId, {
    name,
    phone,
    email,
    preferredLanguage,
    notes,
  });

  if (!result.ok) {
    if (result.error === "duplicate_phone") {
      return { ok: false, error: "A customer with this phone number already exists" };
    }
    return { ok: false, error: result.error };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateCustomerAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const customerId = str(formData.get("customerId"));
  const name = str(formData.get("name"));
  const phone = str(formData.get("phone"));
  const email = str(formData.get("email")) || undefined;
  const preferredLanguage = str(formData.get("preferredLanguage")) || undefined;
  const notes = str(formData.get("notes")) || undefined;

  if (!customerId || !name || !phone) {
    return { ok: false, error: "Customer ID, name, and phone are required" };
  }

  const result = await updateCustomer(organizationId, customerId, {
    name,
    phone,
    email,
    preferredLanguage,
    notes,
  });

  if (!result.ok) {
    if (result.error === "duplicate_phone") {
      return { ok: false, error: "A customer with this phone number already exists" };
    }
    return { ok: false, error: result.error };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteCustomerAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const customerId = str(formData.get("customerId"));

  if (!customerId) {
    return { ok: false, error: "Customer ID is required" };
  }

  const result = await deleteCustomer(organizationId, customerId);

  if (!result.ok) {
    if (result.error === "has_reservations") {
      return {
        ok: false,
        error: "Cannot delete customer with existing reservations",
      };
    }
    return { ok: false, error: result.error };
  }

  revalidatePath(PATH);
  return { ok: true };
}
