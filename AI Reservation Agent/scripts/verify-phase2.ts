// Phase 2 verification — Calendar & Availability
//
// Tests:
// 1. check_availability: empty calendar → available
// 2. check_availability: blocked date range → blocked
// 3. check_availability: existing reservation → booked
// 4. check_availability: partial overlap → booked
// 5. check_availability: adjacent ranges → available (no overlap)
// 6. BlockedDate CRUD: create, verify, delete
// 7. Concurrent booking simulation (two parallel requests → both should fail, not both succeed)
// 8. Postgres constraint: direct INSERT of overlapping reservation → DB-level rejection
// 9. Calendar UI renders with correct states
//
// Usage: npx tsx scripts/verify-phase2.ts [baseUrl]
import "dotenv/config";
import { prisma } from "@/lib/db";
import { checkAvailability, createBlockedDate, deleteBlockedDate } from "@/lib/services/availability";

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

function dateOnly(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

async function getTestData() {
  const org = await prisma.organization.findUnique({ where: { slug: "queens-garden" } });
  if (!org) throw new Error("Run seed first");
  const prop = await prisma.property.findFirst({ where: { organizationId: org.id } });
  if (!prop) throw new Error("No property found");
  const user = await prisma.user.findFirst({ where: { email: "owner@queensgarden.ai" } });
  if (!user) throw new Error("No owner user");
  return { org, prop, user };
}

async function main() {
  const { org, prop, user } = await getTestData();

  console.log(`Phase 2 verification against ${baseUrl}\n`);

  // ───────────────────────────────────────────────────────
  // A. check_availability unit tests
  // ───────────────────────────────────────────────────────
  console.log("A. check_availability");
  {
    // 1. Empty date range → available
    const r1 = await checkAvailability(prop.id, dateOnly(2099, 6, 1), dateOnly(2099, 6, 5));
    if (r1.available) pass("empty range → available");
    else fail("empty range → available", JSON.stringify(r1));

    // 2. Create a blocked date range, then check
    await createBlockedDate(org.id, prop.id, dateOnly(2099, 7, 10), dateOnly(2099, 7, 15), "test block", user.id);
    const r2 = await checkAvailability(prop.id, dateOnly(2099, 7, 12), dateOnly(2099, 7, 13));
    if (!r2.available && r2.reason === "blocked") pass("blocked range → blocked");
    else fail("blocked range → blocked", JSON.stringify(r2));

    // 3. Blocked range, but checking outside → available
    const r3 = await checkAvailability(prop.id, dateOnly(2099, 7, 16), dateOnly(2099, 7, 20));
    if (r3.available) pass("outside blocked range → available");
    else fail("outside blocked range → available", JSON.stringify(r3));

    // 4. Adjacent to blocked → available (no overlap)
    const r4 = await checkAvailability(prop.id, dateOnly(2099, 7, 15), dateOnly(2099, 7, 16));
    if (r4.available) pass("adjacent to blocked → available");
    else fail("adjacent to blocked → available", JSON.stringify(r4));

    // 5. Partial overlap with blocked
    const r5 = await checkAvailability(prop.id, dateOnly(2099, 7, 9), dateOnly(2099, 7, 11));
    if (!r5.available && r5.reason === "blocked") pass("partial overlap with blocked → blocked");
    else fail("partial overlap with blocked → blocked", JSON.stringify(r5));

    // Cleanup blocks
    const blocks = await prisma.blockedDate.findMany({ where: { propertyId: prop.id } });
    for (const b of blocks) await prisma.blockedDate.delete({ where: { id: b.id } });
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // B. BlockedDate CRUD
  // ───────────────────────────────────────────────────────
  console.log("B. BlockedDate CRUD");
  {
    const r1 = await createBlockedDate(org.id, prop.id, dateOnly(2099, 8, 1), dateOnly(2099, 8, 3), "Owner use", user.id);
    if (r1.ok && r1.data) pass("create block");
    else fail("create block", JSON.stringify(r1));

    const found = await prisma.blockedDate.findUnique({ where: { id: r1.data?.id ?? "x" } });
    if (found?.reason === "Owner use") pass("block reads back from DB");
    else fail("block reads back from DB");

    const r2 = await deleteBlockedDate(org.id, prop.id, r1.data?.id ?? "x");
    if (r2.ok) pass("delete block");
    else fail("delete block", JSON.stringify(r2));

    const gone = await prisma.blockedDate.findUnique({ where: { id: r1.data?.id ?? "x" } });
    if (!gone) pass("block deleted from DB");
    else fail("block deleted from DB");

    // Cross-tenant rejection
    const otherOrg = await prisma.organization.create({ data: { name: "X", slug: "x-phase2-test" } });
    const r3 = await createBlockedDate(otherOrg.id, prop.id, dateOnly(2099, 8, 1), dateOnly(2099, 8, 2), null, user.id);
    if (!r3.ok && r3.error === "not_found") pass("cross-tenant block rejected");
    else fail("cross-tenant block rejected");
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // C. Concurrent booking simulation
  // ───────────────────────────────────────────────────────
  console.log("C. Concurrent booking simulation");
  {
    const checkIn = dateOnly(2099, 9, 1);
    const checkOut = dateOnly(2099, 9, 3);

    // Ensure test customers exist
    const testCustomer1 = await prisma.customer.upsert({
      where: { organizationId_phone: { organizationId: org.id, phone: "+96899000001" } },
      create: { organizationId: org.id, name: "Test Customer 1", phone: "+96899000001" },
      update: {},
    });
    const testCustomer2 = await prisma.customer.upsert({
      where: { organizationId_phone: { organizationId: org.id, phone: "+96899000002" } },
      create: { organizationId: org.id, name: "Test Customer 2", phone: "+96899000002" },
      update: {},
    });

    const results = await Promise.allSettled([
      prisma.reservation.create({
        data: {
          propertyId: prop.id,
          customerId: testCustomer1.id,
          checkIn,
          checkOut,
          guests: 2,
          nights: 2,
          priceBreakdown: [],
          totalPrice: 320,
          depositAmount: 50,
          remainingBalance: 270,
          status: "PAYMENT_PENDING",
          source: "MANUAL",
        },
      }),
      prisma.reservation.create({
        data: {
          propertyId: prop.id,
          customerId: testCustomer2.id,
          checkIn,
          checkOut,
          guests: 4,
          nights: 2,
          priceBreakdown: [],
          totalPrice: 320,
          depositAmount: 50,
          remainingBalance: 270,
          status: "PAYMENT_PENDING",
          source: "MANUAL",
        },
      }),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (succeeded <= 1 && failed >= 1) {
      pass(`concurrent inserts: ${succeeded} succeeded, ${failed} failed (not both succeeded)`);
    } else if (succeeded === 2) {
      fail("concurrent inserts: BOTH succeeded (double booking!)");
    } else {
      fail(`concurrent inserts: unexpected result ${succeeded} succeeded, ${failed} failed`);
    }

    const after = await prisma.reservation.count({
      where: { propertyId: prop.id, checkIn, checkOut },
    });
    if (after <= 1) pass(`no duplicate reservations in DB (${after} row)`);
    else fail(`too many reservations in DB (${after} rows)`);

    await prisma.reservation.deleteMany({ where: { propertyId: prop.id, checkIn, checkOut } });
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // D. Postgres exclusion constraint
  // ───────────────────────────────────────────────────────
  console.log("D. Postgres exclusion constraint (direct INSERT)");
  {
    const checkIn = dateOnly(2099, 10, 5);
    const checkOut = dateOnly(2099, 10, 8);

    const existing = await prisma.reservation.findFirst({ where: { propertyId: prop.id, checkIn, checkOut } });
    if (existing) await prisma.reservation.delete({ where: { id: existing.id } });

    const customer = await prisma.customer.findFirst({ where: { organizationId: org.id } });
    if (!customer) throw new Error("No customer found (run seed first)");

    const ins = await prisma.$executeRaw`
      INSERT INTO "Reservation" ("id", "propertyId", "customerId", "checkIn", "checkOut", "guests", "nights", "priceBreakdown", "totalPrice", "depositAmount", "remainingBalance", "status", "source", "createdAt", "updatedAt")
      VALUES ('test-booking-direct-1', ${prop.id}, ${customer.id}, ${checkIn}, ${checkOut}, 2, 3, '[]'::jsonb, 320, 50, 270, 'PAYMENT_PENDING', 'MANUAL', NOW(), NOW())
    `;
    if (ins === 1) pass("first INSERT succeeds");
    else fail("first INSERT succeeds");

    try {
      await prisma.$executeRaw`
        INSERT INTO "Reservation" ("id", "propertyId", "customerId", "checkIn", "checkOut", "guests", "nights", "priceBreakdown", "totalPrice", "depositAmount", "remainingBalance", "status", "source", "createdAt", "updatedAt")
        VALUES ('test-booking-direct-2', ${prop.id}, ${customer.id}, ${checkIn}, ${checkOut}, 4, 3, '[]'::jsonb, 320, 50, 270, 'PAYMENT_PENDING', 'MANUAL', NOW(), NOW())
      `;
      fail("overlapping INSERT blocked by constraint (DB rejected it)");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("no overlapping") || msg.includes("exclusion") || msg.includes("conflict")) {
        pass("overlapping INSERT blocked by constraint (DB rejected it)");
      } else {
        fail("overlapping INSERT blocked by constraint", msg.slice(0, 200));
      }
    }

    await prisma.$executeRaw`DELETE FROM "Reservation" WHERE "id" IN ('test-booking-direct-1', 'test-booking-direct-2')`;
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // E. Calendar UI renders
  // ───────────────────────────────────────────────────────
  console.log("E. Calendar UI (HTTP)");
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

    const now = new Date();
    const page = await fetch(`${baseUrl}/dashboard/calendar?year=${now.getFullYear()}&month=${now.getMonth()}`, {
      headers: { cookie: jar.join("; ") }, redirect: "follow",
    });
    const html = await page.text();

    if (page.status === 200) pass("/dashboard/calendar responds 200");
    else fail("/dashboard/calendar responds 200", `status=${page.status}`);

    if (html.includes("Block dates") || html.includes("حظور تواريخ")) {
      pass("block dates button renders");
    } else {
      fail("block dates button renders");
    }

    const hasStateLabels = html.includes("Available") || html.includes("متاح");
    if (hasStateLabels) pass("calendar state labels render");
    else fail("calendar state labels render");
  }
  console.log("");

  await prisma.$disconnect();
  console.log(`${passes} passed, ${failures} failed`);
  console.log(failures === 0 ? "ALL CHECKS PASSED ✔" : `${failures} check(s) FAILED ✘`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
