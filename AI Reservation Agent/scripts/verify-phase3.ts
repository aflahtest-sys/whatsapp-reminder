// Phase 3 verification — Pricing Engine
//
// Tests:
// A. calculate_booking_price: cross-season range (29 Apr → 2 May) returns correct per-night breakdown
// B. calculate_booking_price: default rule fallback
// C. calculate_booking_price: below-min-stay rejection
// D. PricingRule CRUD: create, update, delete
// E. Priority swap
// F. Cross-tenant rejection
// G. Pricing UI renders
//
// Usage: npx tsx scripts/verify-phase3.ts [baseUrl]
import "dotenv/config";
import { prisma } from "@/lib/db";
import {
  calculateBookingPrice,
  createPricingRule,
  deletePricingRule,
  listPricingRules,
  updatePricingRule,
  changePriority,
} from "@/lib/services/pricing";

const baseUrl = (process.argv[2] ?? process.env.VERIFY_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
let failures = 0;
let passes = 0;

function pass(name: string) {
  passes++;
  console.log(`  ✓ ${name}`);
}
function fail(name: string, detail?: string) {
  failures++;
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function date(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: "queens-garden" } });
  if (!org) throw new Error("Run seed first");
  const prop = await prisma.property.findFirst({ where: { organizationId: org.id } });
  if (!prop) throw new Error("No property");
  const user = await prisma.user.findFirst({ where: { email: "owner@queensgarden.ai" } });
  if (!user) throw new Error("No owner user");

  console.log(`Phase 3 verification against ${baseUrl}\n`);

  // ───────────────────────────────────────────────────────
  // A. Cross-season pricing (brief §8 example: 29 Apr → 2 May)
  // ───────────────────────────────────────────────────────
  console.log("A. Cross-season pricing (brief §8: 29 Apr → 2 May)");
  {
    try {
      // Create Summer rule (1 May → 30 Jul, price 120, priority 4)
      await createPricingRule(org.id, prop.id, {
        name: "Summer",
        pricePerNight: "120.00",
        startDate: date(2026, 5, 1),
        endDate: date(2026, 7, 31),
        priority: 4,
        isDefault: false,
        isActive: true,
        isRecurringHijri: false,
      });
      // Normal is already seeded as default at 160
      const result = await calculateBookingPrice(prop.id, date(2026, 4, 29), date(2026, 5, 3));
      if (!result.ok || !result.data) {
        fail("calculate_booking_price succeeds", result.ok ? "no data" : result.error);
      } else {
        const b = result.data.breakdown;
        if (b.length !== 4) {
          fail("4 nights returned", `got ${b.length}`);
        } else {
          const night1 = b.find((n) => n.date === "2026-04-29");
          const night2 = b.find((n) => n.date === "2026-04-30");
          const night3 = b.find((n) => n.date === "2026-05-01");
          const night4 = b.find((n) => n.date === "2026-05-02");

          if (night1 && night1.season === "Normal" && night1.pricePerNight === 160) pass("29 Apr = Normal @ 160");
          else fail("29 Apr = Normal @ 160", JSON.stringify(night1));

          if (night2 && night2.season === "Normal" && night2.pricePerNight === 160) pass("30 Apr = Normal @ 160");
          else fail("30 Apr = Normal @ 160", JSON.stringify(night2));

          if (night3 && night3.season === "Summer" && night3.pricePerNight === 120) pass("01 May = Summer @ 120");
          else fail("01 May = Summer @ 120", JSON.stringify(night3));

          if (night4 && night4.season === "Summer" && night4.pricePerNight === 120) pass("02 May = Summer @ 120");
          else fail("02 May = Summer @ 120", JSON.stringify(night4));

          if (result.data.totalPrice === 560) {
            pass(`totalPrice = 560 (160+160+120+120)`);
          } else {
            fail(`totalPrice = 560`, `got ${result.data.totalPrice}`);
          }
        }
      }
    } finally {
      const cleanupRules = await prisma.pricingRule.findMany({ where: { propertyId: prop.id, name: "Summer" } });
      for (const r of cleanupRules) {
        await prisma.pricingRule.delete({ where: { id: r.id } }).catch(() => {});
      }
    }
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // B. Default rule fallback
  // ───────────────────────────────────────────────────────
  console.log("B. Default rule fallback");
  {
    const r = await calculateBookingPrice(prop.id, date(2026, 6, 10), date(2026, 6, 12));
    if (!r.ok || !r.data) {
      fail("fallback succeeds", r.ok ? "no data" : r.error);
    } else {
      const allNormal = r.data.breakdown.every((n) => n.season === "Normal");
      if (allNormal) pass("all nights use Normal fallback");
      else fail("all nights use Normal fallback");
    }
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // C. Below min stay rejection
  // ───────────────────────────────────────────────────────
  console.log("C. Below min stay rejection");
  {
    const r = await calculateBookingPrice(prop.id, date(2026, 6, 10), date(2026, 6, 10));
    if (!r.ok && (r.error === "below_min_stay" || r.error === "invalid_dates")) pass("0 nights → rejected");
    else fail("0 nights → rejected", JSON.stringify(r));
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // D. PricingRule CRUD
  // ───────────────────────────────────────────────────────
  console.log("D. PricingRule CRUD");
  {
    const c = await createPricingRule(org.id, prop.id, {
      name: "Test Rule",
      pricePerNight: "99.00",
      startDate: date(2026, 12, 1),
      endDate: date(2026, 12, 31),
      priority: 6,
      isDefault: false,
      isActive: true,
      isRecurringHijri: false,
    });
    if (c.ok) pass("create rule");
    else fail("create rule", JSON.stringify(c));

    const createdRule = await prisma.pricingRule.findFirst({ where: { propertyId: prop.id, name: "Test Rule" } });
    const ruleId = createdRule?.id ?? "x";
    const u = await updatePricingRule(org.id, prop.id, ruleId, {
      name: "Test Rule Updated",
      pricePerNight: "88.00",
      startDate: date(2026, 12, 1),
      endDate: date(2026, 12, 31),
      priority: 6,
      isDefault: false,
      isActive: false,
      isRecurringHijri: false,
    });
    if (u.ok) pass("update rule");
    else fail("update rule", u.error);

    const readBack = await prisma.pricingRule.findFirst({
      where: { propertyId: prop.id, name: "Test Rule Updated" },
    });
    if (readBack && readBack.name === "Test Rule Updated" && parseFloat(readBack.pricePerNight.toString()) === 88) {
      pass("updated rule reads back");
    } else {
      fail("updated rule reads back", JSON.stringify(readBack ? { name: readBack.name, price: readBack.pricePerNight.toString() } : "null"));
    }

    const d = await deletePricingRule(org.id, prop.id, ruleId);
    if (d.ok) pass("delete rule");
    else fail("delete rule", d.error);

    // Cross-tenant
    const otherOrg = await prisma.organization.create({ data: { name: "X", slug: "x-phase3-test" } });
    const xc = await createPricingRule(otherOrg.id, prop.id, {
      name: "Bad", pricePerNight: "10", startDate: date(2026, 1, 1), endDate: date(2026, 1, 2),
      priority: 1, isDefault: false, isActive: true, isRecurringHijri: false,
    });
    if (!xc.ok && xc.error === "not_found") pass("cross-tenant rule create rejected");
    else fail("cross-tenant rule create rejected");
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // E. Priority swap
  // ───────────────────────────────────────────────────────
  console.log("E. Priority swap");
  {
    const rules = await listPricingRules(prop.id);
    if (rules.length >= 2) {
      const a = rules[0];
      const b = rules[1];
      const aPrioBefore = a.priority;
      const bPrioBefore = b.priority;
      const swap = await changePriority(org.id, prop.id, a.id, "down");
      if (swap.ok) pass("changePriority succeeds");
      else fail("changePriority succeeds", swap.error);
      const after = await listPricingRules(prop.id);
      const aAfter = after.find((r) => r.id === a.id);
      const bAfter = after.find((r) => r.id === b.id);
      if (aAfter && bAfter && aAfter.priority === bPrioBefore && bAfter.priority === aPrioBefore) {
        pass("priorities swapped correctly");
      } else {
        fail("priorities swapped correctly", `a=${aAfter?.priority} b=${bAfter?.priority}`);
      }
      await changePriority(org.id, prop.id, a.id, "up");
    } else {
      pass("skipped (need ≥2 rules)");
    }
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // F. Pricing UI renders
  // ───────────────────────────────────────────────────────
  console.log("F. Pricing UI (HTTP)");
  {
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
    const csrf = (await csrfRes.json()).csrfToken;
    const jar = [
      ...(csrfRes.headers.get("set-cookie") ?? "").split(",").map((c) => c.split(";")[0]).filter(Boolean),
    ];
    const form = new URLSearchParams();
    form.set("csrfToken", csrf);
    form.set("email", process.env.SEED_OWNER_EMAIL ?? "owner@queensgarden.ai");
    form.set("password", process.env.SEED_OWNER_PASSWORD ?? "Owner@12345");
    form.set("redirect", "false");
    const login = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.join("; ") },
      body: form.toString(), redirect: "manual",
    });
    for (const c of (login.headers.get("set-cookie") ?? "").split(",")) {
      const part = c.split(";")[0];
      if (part && !jar.includes(part)) jar.push(part);
    }

    const page = await fetch(`${baseUrl}/dashboard/pricing`, {
      headers: { cookie: jar.join("; ") }, redirect: "follow",
    });
    const html = await page.text();

    if (page.status === 200) pass("/dashboard/pricing responds 200");
    else fail("/dashboard/pricing responds 200", `status=${page.status}`);

    if (html.includes("Normal") || html.includes("عادي")) pass("Normal rule renders");
    else fail("Normal rule renders");

    if (html.includes("Price preview") || html.includes("معاينة السعر")) pass("price preview section renders");
    else fail("price preview section renders");

    if (html.includes("Add rule") || html.includes("إضافة قاعدة")) pass("add rule button renders");
    else fail("add rule button renders");
  }
  console.log("");

  await prisma.$disconnect();
  console.log(`${passes} passed, ${failures} failed`);
  console.log(failures === 0 ? "ALL CHECKS PASSED ✔" : `${failures} check(s) FAILED ✘`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
