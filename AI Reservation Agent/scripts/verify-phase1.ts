// Phase 1 verification.
//
// Part A (DB + service layer, through the real /lib/services code the server
// actions use): property update, photo sync, knowledge entry create/update/
// delete, AI-facing fetch, and cross-tenant rejection.
// Part B (HTTP): org owner sees the Resort Information page with the property
// and knowledge base rendered.
//
// Usage: npx tsx scripts/verify-phase1.ts [baseUrl]
import "dotenv/config";
import { prisma } from "@/lib/db";
import {
  updateProperty,
  syncPropertyPhotos,
  getResortProperty,
} from "@/lib/services/property";
import {
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  getAiKnowledge,
} from "@/lib/services/knowledgeBase";

const baseUrl = (process.argv[2] ?? process.env.VERIFY_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
let failures = 0;

function pass(name: string) {
  console.log(`  ✓ ${name}`);
}
function fail(name: string, detail?: string) {
  failures++;
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function getOrg() {
  const org = await prisma.organization.findUnique({ where: { slug: "queens-garden" } });
  if (!org) throw new Error("Queens Garden org not found (run the seed first)");
  return org;
}

async function getProperty() {
  const property = await getResortProperty((await getOrg()).id);
  if (!property) throw new Error("Queens Garden Chalet not found (run the seed first)");
  return property;
}

async function main() {
  const org = await getOrg();
  const property = await getProperty();

  console.log(`Phase 1 verification against ${baseUrl}\n`);

  // ---- Part A: service layer ----
  console.log("A. Property + knowledge base service layer (org-scoped)");
  {
  const original = {
    description: property.description,
    facilities: JSON.stringify(property.facilities),
  };

  try {
    // 1. Update property
    const updated = await updateProperty(org.id, property.id, {
      name: property.name,
      description: `${property.description} [verified via Phase 1]`,
      addressText: property.addressText,
      mapsUrl: property.mapsUrl,
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
      maxGuests: property.maxGuests,
      bedrooms: property.bedrooms,
      beds: property.beds,
      bathrooms: property.bathrooms,
      minStayNights: property.minStayNights,
      allowSameDayBooking: property.allowSameDayBooking,
      depositAmount: property.depositAmount.toString(),
      cancellationRefundDays: property.cancellationRefundDays,
      facilities: property.facilities as never,
    });
    if (updated.ok) pass("updateProperty persists changes");
    else fail("updateProperty persists changes", updated.error);

    const afterUpdate = await prisma.property.findUnique({ where: { id: property.id } });
    if (afterUpdate?.description.includes("verified via Phase 1")) {
      pass("updated description reads back from DB");
    } else {
      fail("updated description reads back from DB");
    }

    // 2. Cross-tenant rejection
    const otherOrg = await prisma.organization.create({
      data: { name: "Intruder Org", slug: "intruder-org-phase1" },
    });
    try {
      const rogue = await updateProperty(otherOrg.id, property.id, {
        name: property.name,
        description: "hacked",
        addressText: "x",
        mapsUrl: null,
        checkInTime: "12:00",
        checkOutTime: "12:00",
        maxGuests: 20,
        bedrooms: 7,
        beds: 20,
        bathrooms: 10,
        minStayNights: 1,
        allowSameDayBooking: true,
        depositAmount: "50",
        cancellationRefundDays: 7,
        facilities: [],
      });
      if (!rogue.ok && rogue.error === "not_found") pass("cross-tenant property update rejected");
      else fail("cross-tenant property update rejected", JSON.stringify(rogue));
    } finally {
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    }

    // 3. Photos sync
    const photoResult = await syncPropertyPhotos(org.id, property.id, [
      { url: "https://example.com/photo1.jpg", altText: "Pool" },
    ]);
    if (photoResult.ok) pass("syncPropertyPhotos adds photos");
    else fail("syncPropertyPhotos adds photos", photoResult.error);
    const withPhoto = await prisma.property.findUnique({
      where: { id: property.id },
      include: { images: true },
    });
    if (withPhoto?.images.length === 1 && withPhoto.images[0].url.includes("photo1")) {
      pass("photo persisted");
    } else {
      fail("photo persisted");
    }

    // 4. Knowledge entries CRUD
    const created = await createKnowledgeEntry(org.id, property.id, {
      type: "FAQ",
      question: "Test question?",
      contentEn: "Test answer EN",
      contentAr: "إجابة اختبار",
      isActive: true,
      sortOrder: 99,
    });
    if (!created.ok || !created.data) {
      fail("createKnowledgeEntry", JSON.stringify(created));
    } else {
      pass("createKnowledgeEntry");
      const entryId = created.data.id;
      const updated = await updateKnowledgeEntry(org.id, property.id, entryId, {
        type: "FAQ",
        question: "Test question?",
        contentEn: "Test answer EN v2",
        contentAr: "إجابة اختبار v2",
        isActive: false,
        sortOrder: 99,
      });
      if (updated.ok) pass("updateKnowledgeEntry");
      else fail("updateKnowledgeEntry", updated.error);

      const read = await prisma.knowledgeBaseEntry.findUnique({ where: { id: entryId } });
      if (read?.contentEn === "Test answer EN v2" && read.isActive === false) {
        pass("updated entry reads back from DB");
      } else {
        fail("updated entry reads back from DB");
      }

      const deleted = await deleteKnowledgeEntry(org.id, property.id, entryId);
      const gone = await prisma.knowledgeBaseEntry.findUnique({ where: { id: entryId } });
      if (deleted.ok && !gone) pass("deleteKnowledgeEntry");
      else fail("deleteKnowledgeEntry");
    }

    // 5. Cross-tenant KB rejection
    const otherOrg2 = await prisma.organization.create({
      data: { name: "Intruder Org 2", slug: "intruder-org-phase1b" },
    });
    try {
      const rogue = await createKnowledgeEntry(otherOrg2.id, property.id, {
        type: "FAQ",
        question: "x",
        contentEn: "y",
        contentAr: "z",
        isActive: true,
        sortOrder: 0,
      });
      if (!rogue.ok && rogue.error === "not_found") pass("cross-tenant KB create rejected");
      else fail("cross-tenant KB create rejected", JSON.stringify(rogue));
    } finally {
      await prisma.organization.delete({ where: { id: otherOrg2.id } });
    }

    // 6. AI-facing fetch
    const ai = await getAiKnowledge(property.id);
    if (ai && ai.property.name === property.name && Array.isArray(ai.entries)) {
      pass(`getAiKnowledge returns property + ${ai.entries.length} entry/entries`);
    } else {
      fail("getAiKnowledge");
    }
  } finally {
    // Restore original property values so the app stays clean.
    await updateProperty(org.id, property.id, {
      name: property.name,
      description: original.description,
      addressText: property.addressText,
      mapsUrl: property.mapsUrl,
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
      maxGuests: property.maxGuests,
      bedrooms: property.bedrooms,
      beds: property.beds,
      bathrooms: property.bathrooms,
      minStayNights: property.minStayNights,
      allowSameDayBooking: property.allowSameDayBooking,
      depositAmount: property.depositAmount.toString(),
      cancellationRefundDays: property.cancellationRefundDays,
      facilities: JSON.parse(original.facilities) as never,
    });
    await syncPropertyPhotos(org.id, property.id, []);
    await prisma.knowledgeBaseEntry.deleteMany({ where: { sortOrder: 99 } });
  }
}
console.log("");

// ---- Part B: page renders ----
console.log("B. Resort Information page (HTTP)");
{
  // Sign in as the org owner and read /dashboard/resort-info.
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  const csrf = (await csrfRes.json()).csrfToken;
  const jar = [
    ...(csrfRes.headers.get("set-cookie") ?? "")
      .split(",")
      .map((c) => c.split(";")[0])
      .filter(Boolean),
  ];
  const form = new URLSearchParams();
  form.set("csrfToken", csrf);
  form.set("email", process.env.SEED_OWNER_EMAIL ?? "owner@queensgarden.ai");
  form.set("password", process.env.SEED_OWNER_PASSWORD ?? "Owner@12345");
  form.set("redirect", "false");

  const login = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.join("; ") },
    body: form.toString(),
    redirect: "manual",
  });
  for (const c of (login.headers.get("set-cookie") ?? "").split(",")) {
    const part = c.split(";")[0];
    if (part && !jar.includes(part)) jar.push(part);
  }

  const page = await fetch(`${baseUrl}/dashboard/resort-info`, {
    headers: { cookie: jar.join("; ") },
    redirect: "follow",
  });
  const html = await page.text();

  if (page.status === 200) pass("/dashboard/resort-info responds 200");
  else fail("/dashboard/resort-info responds 200", `status=${page.status}`);

  if (html.includes("Queens Garden Chalet")) pass("page shows property name");
  else fail("page shows property name");

  if (html.includes("Swimming Pool")) pass("facilities render as chips (not JSON)");
  else fail("facilities render as chips");

  if (html.includes("What are the check-in and check-out times?")) {
    pass("knowledge base entry (FAQ) renders");
  } else {
    fail("knowledge base entry (FAQ) renders");
  }

  if (html.includes("Nizwa, Oman")) pass("property location renders");
  else fail("property location renders");
  console.log("");

  await prisma.$disconnect();
  console.log(failures === 0 ? "ALL CHECKS PASSED ✔" : `${failures} check(s) FAILED ✘`);
  process.exit(failures === 0 ? 0 : 1);
  }
}

void main();
