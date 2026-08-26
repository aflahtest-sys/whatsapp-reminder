import { prisma } from "@/lib/db";
import { propertyBelongsToOrg } from "@/lib/services/property";

export type AvailabilityResult =
  | { available: true }
  | { available: false; reason: "blocked"; overlaps: BlockedDate[] }
  | { available: false; reason: "booked"; overlaps: ReservationOverlap[] };

export type BlockedDate = { id: string; startDate: Date; endDate: Date; reason: string | null };
export type ReservationOverlap = { id: string; checkIn: Date; checkOut: Date; status: string };
export type CalendarDay = {
  date: string;
  state: "available" | "booked" | "payment_pending" | "blocked" | "completed";
  reservations: CalendarReservation[];
  blocks: CalendarBlock[];
};

export type CalendarReservation = {
  id: string;
  checkIn: string;
  checkOut: string;
  status: string;
  customerName: string | null;
  guests: number;
};

export type CalendarBlock = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
};

export async function checkAvailability(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string
): Promise<AvailabilityResult> {
  if (checkIn >= checkOut) {
    return { available: false, reason: "blocked", overlaps: [] };
  }

  const blocked = await prisma.blockedDate.findMany({
    where: {
      propertyId,
      startDate: { lt: checkOut },
      endDate: { gt: checkIn },
    },
  });

  if (blocked.length > 0) {
    return { available: false, reason: "blocked", overlaps: blocked };
  }

  const conflicting = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: { in: ["PAYMENT_PENDING", "CONFIRMED"] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    select: { id: true, checkIn: true, checkOut: true, status: true },
  });

  if (conflicting.length > 0) {
    return {
      available: false,
      reason: "booked",
      overlaps: conflicting.map((r) => ({
        id: r.id,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        status: r.status,
      })),
    };
  }

  return { available: true };
}

export async function getCalendarMonth(
  organizationId: string,
  propertyId: string,
  year: number,
  month: number
): Promise<CalendarDay[]> {
  if (!(await propertyBelongsToOrg(organizationId, propertyId))) {
    return [];
  }

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const [reservations, blocks] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        propertyId,
        OR: [
          { checkIn: { lte: monthEnd }, checkOut: { gt: monthStart } },
        ],
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        status: true,
        guests: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.blockedDate.findMany({
      where: {
        propertyId,
        startDate: { lt: monthEnd },
        endDate: { gt: monthStart },
      },
    }),
  ]);

  const daysInMonth = monthEnd.getDate();
  const days: CalendarDay[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const dayReservations = reservations.filter((r) => {
      const rCheckIn = new Date(r.checkIn);
      const rCheckOut = new Date(r.checkOut);
      return rCheckIn <= date && rCheckOut > date;
    });

    const dayBlocks = blocks.filter((b) => {
      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);
      return bStart <= date && bEnd > date;
    });

    let state: CalendarDay["state"] = "available";
    if (dayBlocks.length > 0) {
      state = "blocked";
    } else if (dayReservations.length > 0) {
      const statuses = dayReservations.map((r) => r.status);
      if (statuses.includes("PAYMENT_PENDING")) {
        state = "payment_pending";
      } else if (statuses.includes("CONFIRMED")) {
        state = "booked";
      } else if (statuses.some((s) => s === "COMPLETED")) {
        state = "completed";
      }
    }

    days.push({
      date: dateStr,
      state,
      reservations: dayReservations.map((r) => ({
        id: r.id,
        checkIn: new Date(r.checkIn).toISOString().split("T")[0],
        checkOut: new Date(r.checkOut).toISOString().split("T")[0],
        status: r.status,
        customerName: r.customer?.name ?? null,
        guests: r.guests,
      })),
      blocks: dayBlocks.map((b) => ({
        id: b.id,
        startDate: new Date(b.startDate).toISOString().split("T")[0],
        endDate: new Date(b.endDate).toISOString().split("T")[0],
        reason: b.reason,
      })),
    });
  }

  return days;
}

export async function createBlockedDate(
  organizationId: string,
  propertyId: string,
  startDate: Date,
  endDate: Date,
  reason: string | null,
  createdBy: string
) {
  if (!(await propertyBelongsToOrg(organizationId, propertyId))) {
    return { ok: false as const, error: "not_found" };
  }
  if (startDate >= endDate) {
    return { ok: false as const, error: "invalid_dates" };
  }

  const block = await prisma.blockedDate.create({
    data: {
      propertyId,
      startDate,
      endDate,
      reason,
      createdBy,
    },
  });
  return { ok: true as const, data: block };
}

export async function deleteBlockedDate(
  organizationId: string,
  propertyId: string,
  blockId: string
) {
  if (!(await propertyBelongsToOrg(organizationId, propertyId))) {
    return { ok: false as const, error: "not_found" };
  }

  const block = await prisma.blockedDate.findFirst({
    where: { id: blockId, propertyId },
    select: { id: true },
  });
  if (!block) return { ok: false as const, error: "not_found" };

  await prisma.blockedDate.delete({ where: { id: blockId } });
  return { ok: true as const };
}
