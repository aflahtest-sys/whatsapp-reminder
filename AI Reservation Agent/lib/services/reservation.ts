import { prisma } from "@/lib/db";
import { checkAvailability } from "@/lib/services/availability";
import { calculateBookingPrice } from "@/lib/services/pricing";

export type ServiceResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function listReservations(
  organizationId: string,
  filters?: {
    propertyId?: string;
    status?: string;
    checkInFrom?: string;
    checkInTo?: string;
    search?: string;
  }
) {
  const where: Record<string, unknown> = {
    property: { organizationId },
  };

  if (filters?.propertyId) {
    where.propertyId = filters.propertyId;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.checkInFrom || filters?.checkInTo) {
    where.checkIn = {};
    if (filters.checkInFrom) {
      (where.checkIn as Record<string, Date>).gte = new Date(filters.checkInFrom);
    }
    if (filters.checkInTo) {
      (where.checkIn as Record<string, Date>).lte = new Date(filters.checkInTo);
    }
  }

  if (filters?.search) {
    where.OR = [
      { customer: { name: { contains: filters.search, mode: "insensitive" } } },
      { customer: { phone: { contains: filters.search } } },
    ];
  }

  const reservations = await prisma.reservation.findMany({
    where,
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      payments: true,
    },
    orderBy: { checkIn: "desc" },
  });

  return reservations;
}

export async function getReservation(
  organizationId: string,
  reservationId: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      property: { organizationId },
    },
    include: {
      customer: true,
      property: true,
      payments: true,
    },
  });

  if (!reservation) return null;
  return reservation;
}

export async function createReservation(
  organizationId: string,
  data: {
    propertyId: string;
    customerId: string;
    checkIn: Date;
    checkOut: Date;
    guests: number;
    source?: string;
    notes?: string;
  }
) {
  const property = await prisma.property.findFirst({
    where: { id: data.propertyId, organizationId },
  });

  if (!property) {
    return { ok: false, error: "Property not found" } as const;
  }

  if (data.guests > property.maxGuests) {
    return {
      ok: false,
      error: `Guest count exceeds maximum of ${property.maxGuests}`,
    } as const;
  }

  const availability = await checkAvailability(
    data.propertyId,
    data.checkIn,
    data.checkOut
  );

  if (!availability.available) {
    return {
      ok: false,
      error: availability.reason ?? "Not available",
    } as const;
  }

  const pricing = await calculateBookingPrice(
    data.propertyId,
    data.checkIn,
    data.checkOut
  );

  if (!pricing.ok) {
    return { ok: false, error: pricing.error } as const;
  }
  if (!pricing.data) {
    return { ok: false, error: "pricing_failed" } as const;
  }

  const { nights, breakdown, totalPrice, deposit, remainingBalance } =
    pricing.data;

  const timeDiff = data.checkOut.getTime() - data.checkIn.getTime();
  const computedNights = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  const reservation = await prisma.reservation.create({
    data: {
      propertyId: data.propertyId,
      customerId: data.customerId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      guests: data.guests,
      nights: computedNights > 0 ? computedNights : nights,
      priceBreakdown: breakdown as object,
      totalPrice,
      depositAmount: deposit,
      remainingBalance,
      status: "PAYMENT_PENDING",
      source: "MANUAL",
      notes: data.notes ?? null,
      payments: {
        create: {
          type: "DEPOSIT",
          status: "PENDING",
          method: "MANUAL",
          amount: deposit,
        },
      },
    },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      payments: true,
    },
  });

  return { ok: true, data: reservation } as const;
}

export async function updateReservationDates(
  organizationId: string,
  reservationId: string,
  data: {
    checkIn: Date;
    checkOut: Date;
    guests: number;
  }
) {
  const existing = await prisma.reservation.findFirst({
    where: { id: reservationId, property: { organizationId } },
    include: { property: true },
  });

  if (!existing) {
    return { ok: false, error: "Reservation not found" } as const;
  }

  if (data.guests > existing.property.maxGuests) {
    return {
      ok: false,
      error: `Guest count exceeds maximum of ${existing.property.maxGuests}`,
    } as const;
  }

  const availability = await checkAvailability(
    existing.propertyId,
    data.checkIn,
    data.checkOut,
    reservationId
  );

  if (!availability.available) {
    return {
      ok: false,
      error: availability.reason ?? "Not available",
    } as const;
  }

  const pricing = await calculateBookingPrice(
    existing.propertyId,
    data.checkIn,
    data.checkOut
  );

  if (!pricing.ok) {
    return { ok: false, error: pricing.error } as const;
  }
  if (!pricing.data) {
    return { ok: false, error: "pricing_failed" } as const;
  }

  const { nights, breakdown, totalPrice, deposit, remainingBalance } =
    pricing.data;

  const timeDiff = data.checkOut.getTime() - data.checkIn.getTime();
  const computedNights = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      guests: data.guests,
      nights: computedNights > 0 ? computedNights : nights,
      priceBreakdown: breakdown as object,
      totalPrice,
      depositAmount: deposit,
      remainingBalance,
    },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      payments: true,
    },
  });

  return { ok: true, data: updated } as const;
}

export async function cancelReservation(
  organizationId: string,
  reservationId: string,
  reason?: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, property: { organizationId } },
  });

  if (!reservation) {
    return { ok: false, error: "Reservation not found" } as const;
  }

  if (
    reservation.status !== "PAYMENT_PENDING" &&
    reservation.status !== "CONFIRMED"
  ) {
    return {
      ok: false,
      error: "Only PAYMENT_PENDING or CONFIRMED reservations can be cancelled",
    } as const;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkIn = new Date(reservation.checkIn);
  checkIn.setHours(0, 0, 0, 0);
  const daysUntilCheckIn = Math.ceil(
    (checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  const depositRefundable = daysUntilCheckIn > 7;

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      status: "CANCELLED",
      cancellationReason: reason ?? null,
      depositRefundable,
    },
    include: {
      customer: true,
      property: true,
      payments: true,
    },
  });

  return { ok: true, data: updated } as const;
}

export async function completeReservation(
  organizationId: string,
  reservationId: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, property: { organizationId } },
  });

  if (!reservation) {
    return { ok: false, error: "Reservation not found" } as const;
  }

  if (reservation.status !== "CONFIRMED") {
    return {
      ok: false,
      error: "Only CONFIRMED reservations can be completed",
    } as const;
  }

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "COMPLETED" },
    include: {
      customer: true,
      property: true,
      payments: true,
    },
  });

  return { ok: true, data: updated } as const;
}

export async function markDepositPaid(
  organizationId: string,
  reservationId: string,
  verifiedBy?: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, property: { organizationId } },
    include: { payments: true },
  });

  if (!reservation) {
    return { ok: false, error: "Reservation not found" } as const;
  }

  if (reservation.status !== "PAYMENT_PENDING") {
    return {
      ok: false,
      error: "Reservation is not in PAYMENT_PENDING status",
    } as const;
  }

  const depositPayment = reservation.payments.find(
    (p) => p.type === "DEPOSIT" && p.status === "PENDING"
  );

  if (!depositPayment) {
    return { ok: false, error: "No pending deposit payment found" } as const;
  }

  const now = new Date();

  await prisma.payment.update({
    where: { id: depositPayment.id },
    data: {
      status: "PAID",
      paidAt: now,
      verifiedBy: verifiedBy ?? null,
    },
  });

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "CONFIRMED" },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      property: true,
      payments: true,
    },
  });

  return { ok: true, data: updated } as const;
}
