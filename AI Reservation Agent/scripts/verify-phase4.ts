// Phase 4 verification — Reservation Management
//
// A. Customer CRUD
// B. Reservation create → deposit paid → confirm → cancel flow
// C. Cancel refund eligibility (7-day boundary)
// D. State machine guards (invalid transitions)
// E. Re-validation on edit (availability + pricing recalc)
// F. UI pages render
//
// Usage: npx tsx scripts/verify-phase4.ts [baseUrl]
import "dotenv/config";
import { prisma } from "@/lib/db";
import { createCustomer, listCustomers } from "@/lib/services/customer";
import {
  createReservation,
  cancelReservation,
  markDepositPaid,
  updateReservationDates,
} from "@/lib/services/reservation";

const baseUrl = (process.argv[2] ?? process.env.VERIFY_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
let failures = 0;
let passes = 0;

function pass(name: string) { passes++; console.log(`  ✓ ${name}`); }
function fail(name: string, detail?: string) { failures++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
function date(y: number, m: number, d: number): Date { return new Date(Date.UTC(y, m - 1, d)); }

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: "queens-garden" } });
  if (!org) throw new Error("Run seed first");
  const prop = await prisma.property.findFirst({ where: { organizationId: org.id } });
  if (!prop) throw new Error("No property");

  console.log(`Phase 4 verification against ${baseUrl}\n`);

  // ───────────────────────────────────────────────────────
  // Cleanup from previous runs (idempotent)
  // ───────────────────────────────────────────────────────
  {
    const oldCusts = await prisma.customer.findMany({ where: { organizationId: org.id, phone: "+96890004444" } });
    for (const c of oldCusts) {
      await prisma.payment.deleteMany({ where: { reservation: { customerId: c.id } } });
      await prisma.reservation.deleteMany({ where: { customerId: c.id } });
      await prisma.customer.delete({ where: { id: c.id } });
    }
    // Also clean any orphaned reservations on test dates
    const testCheckIns = [date(2026, 9, 1), date(2026, 9, 20), date(2026, 8, 22), date(2026, 10, 15), date(2026, 12, 1), date(2026, 12, 10)];
    for (const ci of testCheckIns) {
      const orphaned = await prisma.reservation.findMany({
        where: { propertyId: prop.id, checkIn: ci, status: { in: ["PAYMENT_PENDING", "CONFIRMED"] } },
        select: { id: true },
      });
      for (const r of orphaned) {
        await prisma.payment.deleteMany({ where: { reservationId: r.id } });
        await prisma.reservation.delete({ where: { id: r.id } });
      }
    }
    const oldOrgs = await prisma.organization.findMany({ where: { slug: { startsWith: "x-phase4" } } });
    for (const o of oldOrgs) { await prisma.organization.delete({ where: { id: o.id } }); }
  }

  // ───────────────────────────────────────────────────────
  // A. Customer CRUD
  // ───────────────────────────────────────────────────────
  console.log("A. Customer CRUD");
  {
    const c = await createCustomer(org.id, {
      name: "Phase4 Test Guest",
      phone: "+96890004444",
      email: "phase4@test.com",
      preferredLanguage: "en",
      notes: "Test customer",
    });
    if (c.ok) pass("create customer");
    else fail("create customer", JSON.stringify(c));

    const dup = await createCustomer(org.id, {
      name: "Dup",
      phone: "+96890004444",
    });
    if (!dup.ok && dup.error === "duplicate_phone") pass("duplicate phone rejected");
    else fail("duplicate phone rejected", JSON.stringify(dup));

    const list = await listCustomers(org.id, "Phase4");
    if (list.length >= 1) pass("list customers with search");
    else fail("list customers with search");

    const customer = await prisma.customer.findFirst({ where: { organizationId: org.id, phone: "+96890004444" } });
    if (!customer) { fail("customer exists"); return; }

    // Cross-tenant rejection
    const otherOrg = await prisma.organization.create({ data: { name: "X", slug: "x-phase4-test" } });
    const crossList = await listCustomers(otherOrg.id, "Phase4");
    if (crossList.length === 0) pass("cross-tenant customer list empty");
    else fail("cross-tenant customer list empty");
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  }
  console.log("");

  const customer = await prisma.customer.findFirst({ where: { organizationId: org.id, phone: "+96890004444" } });
  if (!customer) { console.log("FATAL: test customer not found"); return; }

  // ───────────────────────────────────────────────────────
  // B. Reservation create → mark deposit paid → confirm flow
  // ───────────────────────────────────────────────────────
  console.log("B. Reservation lifecycle (create → mark deposit paid → confirm)");
  let reservationId: string | null = null;
  {
    const r = await createReservation(org.id, {
      propertyId: prop.id,
      customerId: customer.id,
      checkIn: date(2026, 9, 1),
      checkOut: date(2026, 9, 4),
      guests: 2,
      source: "MANUAL",
    });
    if (r.ok && r.data) {
      pass("create reservation");
      reservationId = r.data.id;
      if (r.data.status === "PAYMENT_PENDING") pass("initial status = PAYMENT_PENDING");
      else fail("initial status = PAYMENT_PENDING", r.data.status);
      if (Number(r.data.totalPrice) > 0) pass("totalPrice > 0");
      else fail("totalPrice > 0");
      if (Number(r.data.depositAmount) >= 0) pass("depositAmount set");
      else fail("depositAmount set");
    } else {
      fail("create reservation", JSON.stringify(r));
    }
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // C. Mark deposit paid → CONFIRMED
  // ───────────────────────────────────────────────────────
  console.log("C. Mark deposit paid");
  if (reservationId) {
    const m = await markDepositPaid(org.id, reservationId, "test-verifier");
    if (m.ok) pass("markDepositPaid succeeds");
    else fail("markDepositPaid succeeds", JSON.stringify(m));

    const after = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { payments: true } });
    if (after?.status === "CONFIRMED") pass("status → CONFIRMED");
    else fail("status → CONFIRMED", after?.status);

    const depositPayment = after?.payments.find((p) => p.type === "DEPOSIT");
    if (depositPayment?.status === "PAID") pass("deposit payment → PAID");
    else fail("deposit payment → PAID", depositPayment?.status);
    if (depositPayment?.verifiedBy === "test-verifier") pass("verifiedBy recorded");
    else fail("verifiedBy recorded");
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // D. Cancel with refund eligibility (§5.4)
  // ───────────────────────────────────────────────────────
  console.log("D. Cancel reservation + refund eligibility");
  if (reservationId) {
    const c = await cancelReservation(org.id, reservationId, "Test cancellation");
    if (c.ok) pass("cancel succeeds");
    else fail("cancel succeeds", JSON.stringify(c));

    const after = await prisma.reservation.findUnique({ where: { id: reservationId } });
    if (after?.status === "CANCELLED") pass("status → CANCELLED");
    else fail("status → CANCELLED", after?.status);
    if (after?.cancellationReason === "Test cancellation") pass("cancellationReason stored");
    else fail("cancellationReason stored");
    if (after?.depositRefundable === true) pass("depositRefundable = true (Sep 1 > 7 days out)");
    else fail("depositRefundable = true (Sep 1 > 7 days out)", `got ${after?.depositRefundable}`);
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // E. Near-date cancellation (not refundable)
  // ───────────────────────────────────────────────────────
  console.log("E. Near-date cancellation (non-refundable)");
  {
    // Use a checkIn within 7 days of today (Aug 17) → Aug 22 = 5 days away
    const r2 = await createReservation(org.id, {
      propertyId: prop.id,
      customerId: customer.id,
      checkIn: date(2026, 8, 22),
      checkOut: date(2026, 8, 24),
      guests: 2,
    });
    if (!r2.ok || !r2.data) { fail("create near-date reservation", JSON.stringify(r2)); }
    else {
      await markDepositPaid(org.id, r2.data.id);
      const c = await cancelReservation(org.id, r2.data.id, "Too close");
      if (c.ok) pass("cancel near-date succeeds");
      else fail("cancel near-date succeeds", JSON.stringify(c));

      const after = await prisma.reservation.findUnique({ where: { id: r2.data.id } });
      if (after?.depositRefundable === false) pass("depositRefundable = false (Aug 22, < 7 days)");
      else fail("depositRefundable = false (Aug 22, < 7 days)", `got ${after?.depositRefundable}`);
    }
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // F. State machine guards
  // ───────────────────────────────────────────────────────
  console.log("F. State machine guards");
  {
    // Cancel a cancelled reservation → should fail
    if (reservationId) {
      const r = await cancelReservation(org.id, reservationId);
      if (!r.ok) pass("cancel already-cancelled → rejected");
      else fail("cancel already-cancelled → rejected");
    }

    // Mark deposit paid on non-existent reservation → should fail
    const r2 = await markDepositPaid(org.id, "nonexistent");
    if (!r2.ok) pass("markDepositPaid on nonexistent → rejected");
    else fail("markDepositPaid on nonexistent → rejected");
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // G. Concurrent booking prevention
  // ───────────────────────────────────────────────────────
  console.log("G. Concurrent booking prevention");
  {
    const p1 = createReservation(org.id, {
      propertyId: prop.id, customerId: customer.id,
      checkIn: date(2026, 12, 1), checkOut: date(2026, 12, 5), guests: 2,
    });
    const p2 = createReservation(org.id, {
      propertyId: prop.id, customerId: customer.id,
      checkIn: date(2026, 12, 3), checkOut: date(2026, 12, 7), guests: 2,
    });
    const results = await Promise.all([p1, p2]);
    const successes = results.filter((r) => r.ok);
    if (successes.length <= 1) pass("at most 1 concurrent booking succeeds");
    else fail("at most 1 concurrent booking succeeds", `${successes.length} succeeded`);
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // H. Re-validation on edit (availability + pricing recalc)
  // ───────────────────────────────────────────────────────
  console.log("H. Edit reservation dates → re-validate + re-calc");
  {
    // Create a fresh reservation for editing
    const r = await createReservation(org.id, {
      propertyId: prop.id, customerId: customer.id,
      checkIn: date(2026, 10, 15), checkOut: date(2026, 10, 17), guests: 2,
    });
    if (!r.ok || !r.data) { fail("create reservation for edit", JSON.stringify(r)); }
    else {
      const origPrice = Number(r.data.totalPrice);
      const u = await updateReservationDates(org.id, r.data.id, {
        checkIn: date(2026, 10, 15),
        checkOut: date(2026, 10, 18),
        guests: 2,
      });
      if (u.ok && u.data) {
        const newPrice = Number(u.data.totalPrice);
        if (newPrice > origPrice) pass("price increased with extra night");
        else fail("price increased with extra night", `orig=${origPrice} new=${newPrice}`);
        if (u.data.nights === 3) pass("nights updated to 3");
        else fail("nights updated to 3", `${u.data.nights}`);
      } else {
        fail("update dates", JSON.stringify(u));
      }

      // Try to edit into a blocked range
      await prisma.blockedDate.create({
        data: { propertyId: prop.id, startDate: date(2026, 11, 1), endDate: date(2026, 11, 10), reason: "Test block", createdBy: "test" },
      });
      const bad = await updateReservationDates(org.id, r.data.id, {
        checkIn: date(2026, 11, 1),
        checkOut: date(2026, 11, 5),
        guests: 2,
      });
      if (!bad.ok) pass("edit into blocked range → rejected");
      else fail("edit into blocked range → rejected");
      await prisma.blockedDate.deleteMany({ where: { propertyId: prop.id, reason: "Test block" } });
    }
  }
  console.log("");

  // ───────────────────────────────────────────────────────
  // I. Dashboard UI pages render
  // ───────────────────────────────────────────────────────
  console.log("I. Dashboard UI (HTTP)");
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
    const cookie = jar.join("; ");

    const pages = [
      { path: "/dashboard/customers", expect: "Customers" },
      { path: "/dashboard/reservations", expect: "Reservations" },
      { path: "/dashboard/payments", expect: "Payments" },
    ];
    for (const p of pages) {
      const res = await fetch(`${baseUrl}${p.path}`, { headers: { cookie }, redirect: "follow" });
      const html = await res.text();
      if (res.status === 200) pass(`${p.path} responds 200`);
      else fail(`${p.path} responds 200`, `status=${res.status}`);
      if (html.includes(p.expect)) pass(`${p.path} renders`);
      else fail(`${p.path} renders`);
    }
  }
  console.log("");

  // Cleanup
  const testReservations = await prisma.reservation.findMany({
    where: { customerId: customer.id },
    select: { id: true },
  });
  for (const r of testReservations) {
    await prisma.payment.deleteMany({ where: { reservationId: r.id } });
    await prisma.reservation.delete({ where: { id: r.id } });
  }
  await prisma.customer.delete({ where: { id: customer.id } });

  await prisma.$disconnect();
  console.log(`${passes} passed, ${failures} failed`);
  console.log(failures === 0 ? "ALL CHECKS PASSED ✔" : `${failures} check(s) FAILED ✘`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
