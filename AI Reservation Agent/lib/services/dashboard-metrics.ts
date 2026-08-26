import { prisma } from "@/lib/db";

export type DashboardMetrics = {
  revenueThisMonth: number;
  currency: string;
  occupancyPercent: number;
  nightsBooked: number;
  nightsTotal: number;
  pendingPayments: number;
  blockedDays: number;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export async function getDashboardMetrics(
  organizationId: string
): Promise<DashboardMetrics> {
  const today = startOfDay(new Date());

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  const todayPlus30 = new Date(today);
  todayPlus30.setDate(todayPlus30.getDate() + 30);

  const property = await prisma.property.findFirst({
    where: { organizationId },
    select: { currency: true },
  });

  const currency = property?.currency ?? "OMR";

  const [revenueResult, pendingResult, blockedDays, occupancyReservations] =
    await Promise.all([
      prisma.reservation.aggregate({
        _sum: { totalPrice: true },
        where: {
          property: { organizationId },
          status: { in: ["CONFIRMED", "COMPLETED"] },
          checkIn: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      prisma.reservation.aggregate({
        _sum: { depositAmount: true },
        where: {
          property: { organizationId },
          status: "PAYMENT_PENDING",
        },
      }),
      prisma.blockedDate.count({
        where: {
          property: { organizationId },
          startDate: { lt: todayPlus30 },
          endDate: { gt: today },
        },
      }),
      prisma.reservation.findMany({
        where: {
          property: { organizationId },
          status: { in: ["CONFIRMED", "PAYMENT_PENDING"] },
          checkIn: { lt: todayPlus30 },
          checkOut: { gt: today },
        },
        select: { checkIn: true, checkOut: true },
      }),
    ]);

  let nightsBooked = 0;
  for (const r of occupancyReservations) {
    const rCheckIn = startOfDay(new Date(r.checkIn));
    const rCheckOut = startOfDay(new Date(r.checkOut));
    const overlapStart = rCheckIn > today ? rCheckIn : today;
    const overlapEnd = rCheckOut < todayPlus30 ? rCheckOut : todayPlus30;
    const diff = overlapEnd.getTime() - overlapStart.getTime();
    if (diff > 0) {
      nightsBooked += Math.ceil(diff / MS_PER_DAY);
    }
  }

  const nightsTotal = 30;
  const occupancyPercent = Math.round((nightsBooked / nightsTotal) * 100);

  return {
    revenueThisMonth: Number(revenueResult._sum.totalPrice ?? 0),
    currency,
    occupancyPercent,
    nightsBooked,
    nightsTotal,
    pendingPayments: Number(pendingResult._sum.depositAmount ?? 0),
    blockedDays,
  };
}
