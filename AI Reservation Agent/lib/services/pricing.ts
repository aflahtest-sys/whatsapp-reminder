import { prisma } from "@/lib/db";
import { propertyBelongsToOrg } from "@/lib/services/property";

export type PricingRuleData = {
  name: string;
  pricePerNight: string;
  startDate: Date;
  endDate: Date;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  isRecurringHijri: boolean;
};

export type PriceBreakdownItem = {
  date: string;
  season: string;
  pricePerNight: number;
};

export type PriceResult = {
  nights: number;
  breakdown: PriceBreakdownItem[];
  totalPrice: number;
  deposit: number;
  remainingBalance: number;
};

export type ServiceResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function listPricingRules(propertyId: string) {
  return prisma.pricingRule.findMany({
    where: { propertyId },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
}

export async function createPricingRule(
  organizationId: string,
  propertyId: string,
  data: PricingRuleData
): Promise<ServiceResult> {
  if (!(await propertyBelongsToOrg(organizationId, propertyId))) {
    return { ok: false, error: "not_found" };
  }
  if (data.pricePerNight === "0" || parseFloat(data.pricePerNight) < 0) {
    return { ok: false, error: "invalid_price" };
  }
  if (data.startDate >= data.endDate) {
    return { ok: false, error: "invalid_dates" };
  }

  if (data.isDefault) {
    await prisma.pricingRule.updateMany({
      where: { propertyId, isDefault: true },
      data: { isDefault: false },
    });
  }

  await prisma.pricingRule.create({
    data: {
      propertyId,
      name: data.name,
      pricePerNight: data.pricePerNight,
      startDate: data.startDate,
      endDate: data.endDate,
      priority: data.priority,
      isDefault: data.isDefault,
      isActive: data.isActive,
      isRecurringHijri: data.isRecurringHijri,
    },
  });
  return { ok: true };
}

export async function updatePricingRule(
  organizationId: string,
  propertyId: string,
  ruleId: string,
  data: PricingRuleData
): Promise<ServiceResult> {
  if (!(await propertyBelongsToOrg(organizationId, propertyId))) {
    return { ok: false, error: "not_found" };
  }

  const existing = await prisma.pricingRule.findFirst({
    where: { id: ruleId, propertyId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "not_found" };

  if (data.isDefault) {
    await prisma.pricingRule.updateMany({
      where: { propertyId, isDefault: true, id: { not: ruleId } },
      data: { isDefault: false },
    });
  }

  await prisma.pricingRule.update({
    where: { id: ruleId },
    data: {
      name: data.name,
      pricePerNight: data.pricePerNight,
      startDate: data.startDate,
      endDate: data.endDate,
      priority: data.priority,
      isDefault: data.isDefault,
      isActive: data.isActive,
      isRecurringHijri: data.isRecurringHijri,
    },
  });
  return { ok: true };
}

export async function deletePricingRule(
  organizationId: string,
  propertyId: string,
  ruleId: string
): Promise<ServiceResult> {
  if (!(await propertyBelongsToOrg(organizationId, propertyId))) {
    return { ok: false, error: "not_found" };
  }

  const existing = await prisma.pricingRule.findFirst({
    where: { id: ruleId, propertyId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "not_found" };

  await prisma.pricingRule.delete({ where: { id: ruleId } });
  return { ok: true };
}

export async function changePriority(
  organizationId: string,
  propertyId: string,
  ruleId: string,
  direction: "up" | "down"
): Promise<ServiceResult> {
  if (!(await propertyBelongsToOrg(organizationId, propertyId))) {
    return { ok: false, error: "not_found" };
  }

  const rules = await prisma.pricingRule.findMany({
    where: { propertyId },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  const idx = rules.findIndex((r) => r.id === ruleId);
  if (idx === -1) return { ok: false, error: "not_found" };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= rules.length) return { ok: false, error: "cannot_move" };

  const a = rules[idx];
  const b = rules[swapIdx];

  await prisma.pricingRule.update({ where: { id: a.id }, data: { priority: b.priority } });
  await prisma.pricingRule.update({ where: { id: b.id }, data: { priority: a.priority } });

  return { ok: true };
}

/**
 * §5.1 — calculate_booking_price.
 * Pure function of current PricingRule rows + property config.
 * Each night is priced independently based on the overlapping rule with the
 * lowest priority number. If no rule matches, the isDefault rule is used.
 */
export async function calculateBookingPrice(
  propertyId: string,
  checkIn: Date,
  checkOut: Date
): Promise<ServiceResult<PriceResult>> {
  if (checkIn >= checkOut) return { ok: false, error: "invalid_dates" };

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return { ok: false, error: "not_found" };

  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  if (nights < property.minStayNights) return { ok: false, error: "below_min_stay" };

  const rules = await prisma.pricingRule.findMany({
    where: { propertyId, isActive: true },
  });

  const defaultRule = rules.find((r) => r.isDefault);
  if (!defaultRule) return { ok: false, error: "no_default_rule" };

  const breakdown: PriceBreakdownItem[] = [];
  let totalPrice = 0;

  for (let i = 0; i < nights; i++) {
    const night = new Date(checkIn);
    night.setDate(night.getDate() + i);

    const candidates = rules
      .filter((r) => !r.isDefault)
      .filter((r) => {
        if (!r.startDate || !r.endDate) return false;
        const start = new Date(r.startDate);
        const end = new Date(r.endDate);
        return night >= start && night < end;
      })
      .sort((a, b) => a.priority - b.priority);

    const rule = candidates.length > 0 ? candidates[0] : defaultRule;
    const price = Number(rule.pricePerNight);

    breakdown.push({
      date: night.toISOString().split("T")[0],
      season: rule.name,
      pricePerNight: price,
    });
    totalPrice += price;
  }

  const deposit = Number(property.depositAmount);
  const remainingBalance = Math.max(0, totalPrice - deposit);

  return {
    ok: true,
    data: { nights, breakdown, totalPrice, deposit, remainingBalance },
  };
}
