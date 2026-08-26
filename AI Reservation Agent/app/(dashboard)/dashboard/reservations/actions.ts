"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listReservations,
  createReservation,
  updateReservationDates,
  cancelReservation,
  markDepositPaid,
  completeReservation,
} from "@/lib/services/reservation";

export type ActionResult = { ok: boolean; error?: string; data?: unknown };

const PATH = "/dashboard/reservations";

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

export async function getReservationsAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const organizationId = await requireOrgScope();
    const status = str(formData.get("status")) || undefined;
    const checkInFrom = str(formData.get("checkInFrom")) || undefined;
    const checkInTo = str(formData.get("checkInTo")) || undefined;
    const search = str(formData.get("search")) || undefined;

    const reservations = await listReservations(organizationId, {
      status,
      checkInFrom,
      checkInTo,
      search,
    });

    const serialized = reservations.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      propertyId: r.propertyId,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      guests: r.guests,
      nights: r.nights,
      totalPrice: Number(r.totalPrice),
      depositAmount: Number(r.depositAmount),
      remainingBalance: Number(r.remainingBalance),
      status: r.status,
      source: r.source,
      cancellationReason: r.cancellationReason,
      depositRefundable: r.depositRefundable,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      customer: r.customer,
      payments: r.payments.map((p) => ({
        id: p.id,
        type: p.type,
        amount: Number(p.amount),
        status: p.status,
        method: p.method,
        paidAt: p.paidAt?.toISOString() ?? null,
        verifiedBy: p.verifiedBy,
      })),
    }));

    return { ok: true, data: serialized };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown_error" };
  }
}

export async function createReservationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const propertyId = str(formData.get("propertyId"));
  const customerId = str(formData.get("customerId"));
  const checkInStr = str(formData.get("checkIn"));
  const checkOutStr = str(formData.get("checkOut"));
  const guests = intValue(formData.get("guests"), 1);
  const notes = str(formData.get("notes")) || undefined;

  if (!propertyId || !customerId || !checkInStr || !checkOutStr) {
    return { ok: false, error: "All fields are required" };
  }

  if (guests < 1) {
    return { ok: false, error: "Guest count must be at least 1" };
  }

  const checkIn = new Date(checkInStr);
  const checkOut = new Date(checkOutStr);
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return { ok: false, error: "Invalid dates" };
  }

  if (checkOut <= checkIn) {
    return { ok: false, error: "Check-out must be after check-in" };
  }

  const result = await createReservation(organizationId, {
    propertyId,
    customerId,
    checkIn,
    checkOut,
    guests,
    notes,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateReservationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const reservationId = str(formData.get("reservationId"));
  const checkInStr = str(formData.get("checkIn"));
  const checkOutStr = str(formData.get("checkOut"));
  const guests = intValue(formData.get("guests"), 1);

  if (!reservationId || !checkInStr || !checkOutStr) {
    return { ok: false, error: "All fields are required" };
  }

  if (guests < 1) {
    return { ok: false, error: "Guest count must be at least 1" };
  }

  const checkIn = new Date(checkInStr);
  const checkOut = new Date(checkOutStr);
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return { ok: false, error: "Invalid dates" };
  }

  if (checkOut <= checkIn) {
    return { ok: false, error: "Check-out must be after check-in" };
  }

  const result = await updateReservationDates(organizationId, reservationId, {
    checkIn,
    checkOut,
    guests,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function cancelReservationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const reservationId = str(formData.get("reservationId"));
  const reason = str(formData.get("reason")) || undefined;

  if (!reservationId) {
    return { ok: false, error: "Reservation ID is required" };
  }

  const result = await cancelReservation(organizationId, reservationId, reason);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function markDepositPaidAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const reservationId = str(formData.get("reservationId"));

  if (!reservationId) {
    return { ok: false, error: "Reservation ID is required" };
  }

  const result = await markDepositPaid(organizationId, reservationId);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function completeReservationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = await requireOrgScope();
  const reservationId = str(formData.get("reservationId"));

  if (!reservationId) {
    return { ok: false, error: "Reservation ID is required" };
  }

  const result = await completeReservation(organizationId, reservationId);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(PATH);
  return { ok: true };
}
