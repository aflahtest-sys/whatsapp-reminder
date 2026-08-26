// Phase 0 seed — creates local dev data:
//   platform admin (Aflah), Queens Garden organization, Queens Garden Chalet
//   property (real details from brief.md §3-4), org owner, and base pricing.
// Idempotent: safe to re-run (uses upserts / create-if-missing).

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const { Decimal } = Prisma;

const SALT_ROUNDS = 10;

async function ensureUser(params: {
  email: string;
  password: string;
  name: string;
  role: "PLATFORM_ADMIN" | "ORG_OWNER" | "ORG_STAFF";
  organizationId?: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: params.email },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: params.name,
        role: params.role,
        organizationId: params.organizationId ?? null,
      },
    });
  }
  return prisma.user.create({
    data: {
      email: params.email,
      passwordHash: await bcrypt.hash(params.password, SALT_ROUNDS),
      name: params.name,
      role: params.role,
      organizationId: params.organizationId,
    },
  });
}

async function ensurePricingRule(params: {
  propertyId: string;
  name: string;
  pricePerNight: string;
  startDate?: Date;
  endDate?: Date;
  priority: number;
  isDefault?: boolean;
  isRecurringHijri?: boolean;
}) {
  const existing = await prisma.pricingRule.findFirst({
    where: { propertyId: params.propertyId, name: params.name },
  });
  if (existing) return existing;
  return prisma.pricingRule.create({
    data: {
      propertyId: params.propertyId,
      name: params.name,
      pricePerNight: params.pricePerNight,
      startDate: params.startDate,
      endDate: params.endDate,
      priority: params.priority,
      isDefault: params.isDefault ?? false,
      isRecurringHijri: params.isRecurringHijri ?? false,
    },
  });
}

async function ensureKnowledgeEntry(params: {
  propertyId: string;
  type: "FACILITY" | "POLICY" | "FAQ" | "LOCATION" | "CONTACT" | "OTHER";
  question?: string;
  contentEn: string;
  contentAr: string;
  sortOrder: number;
}) {
  const existing = await prisma.knowledgeBaseEntry.findFirst({
    where: { propertyId: params.propertyId, question: params.question ?? null, type: params.type },
  });
  if (existing) return existing;
  return prisma.knowledgeBaseEntry.create({
    data: {
      propertyId: params.propertyId,
      type: params.type,
      question: params.question,
      contentEn: params.contentEn,
      contentAr: params.contentAr,
      sortOrder: params.sortOrder,
    },
  });
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "aflah@queensgarden.ai";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "owner@queensgarden.ai";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "Owner@12345";

  const organization = await prisma.organization.upsert({
    where: { slug: "queens-garden" },
    update: { name: "Queens Garden" },
    create: { name: "Queens Garden", slug: "queens-garden" },
  });
  console.log(`Organization ready: ${organization.name}`);

  const admin = await ensureUser({
    email: adminEmail,
    password: adminPassword,
    name: "Aflah",
    role: "PLATFORM_ADMIN",
  });
  console.log(`Platform admin ready: ${admin.email} (${admin.role})`);

  const property = await prisma.property.upsert({
    where: { slug: "queens-garden-chalet" },
    update: { organizationId: organization.id },
    create: {
      organizationId: organization.id,
      name: "Queens Garden Chalet",
      slug: "queens-garden-chalet",
      description:
        "Queens Garden Chalet is a whole-property family chalet in Nizwa, Oman. It features 7 bedrooms with 20 beds and 10 bathrooms, a private swimming pool, a fully equipped kitchen, Wi-Fi, and parking. The chalet comfortably hosts up to 20 guests.",
      addressText: "Nizwa, Oman",
      mapsUrl:
        "https://www.google.com/maps/place/%D8%A7%D8%B3%D8%AA%D8%B1%D8%A7%D8%AD%D8%A9+Queens+Garden+Chalet%E2%80%AD/@22.9840903,57.5571313,1004m/",
      latitude: new Decimal("22.9840903"),
      longitude: new Decimal("57.5571313"),
      maxGuests: 20,
      bedrooms: 7,
      beds: 20,
      bathrooms: 10,
      facilities: [
        {
          key: "swimming-pool",
          label_en: "Swimming Pool",
          label_ar: "مسبح",
          icon: "pool",
        },
        {
          key: "kitchen",
          label_en: "Kitchen",
          label_ar: "مطبخ",
          icon: "kitchen",
        },
        { key: "wifi", label_en: "Wi-Fi", label_ar: "واي فاي", icon: "wifi" },
        {
          key: "parking",
          label_en: "Parking",
          label_ar: "موقف سيارات",
          icon: "parking",
        },
        {
          key: "family-friendly",
          label_en: "Family-Friendly",
          label_ar: "مناسب للعائلات",
          icon: "family",
        },
      ],
      checkInTime: "15:00",
      checkOutTime: "12:00",
      minStayNights: 1,
      allowSameDayBooking: true,
      currency: "OMR",
      depositAmount: new Decimal("50"),
      cancellationRefundDays: 7,
    },
  });
  console.log(`Property ready: ${property.name}`);

  const owner = await ensureUser({
    email: ownerEmail,
    password: ownerPassword,
    name: "Resort Owner",
    role: "ORG_OWNER",
    organizationId: organization.id,
  });
  console.log(`Org owner ready: ${owner.email} (${owner.role})`);

  await ensurePricingRule({
    propertyId: property.id,
    name: "Normal",
    pricePerNight: "160",
    priority: 5,
    isDefault: true,
  });

  await ensurePricingRule({
    propertyId: property.id,
    name: "Summer",
    pricePerNight: "120",
    startDate: new Date("2026-05-01T00:00:00.000Z"),
    endDate: new Date("2026-07-30T00:00:00.000Z"),
    priority: 4,
  });

  console.log("Pricing rules ready (Normal 160 default, Summer 120).");

  await ensureKnowledgeEntry({
    propertyId: property.id,
    type: "FAQ",
    question: "What are the check-in and check-out times?",
    contentEn:
      "Check-in is at 3:00 PM and check-out is at 12:00 PM. Same-day bookings are allowed.",
    contentAr: "تسجيل الوصول في الساعة 3:00 مساءً وتسجيل المغادرة في الساعة 12:00 ظهراً. الحجوزات في نفس اليوم مسموحة.",
    sortOrder: 1,
  });

  await ensureKnowledgeEntry({
    propertyId: property.id,
    type: "POLICY",
    question: "What is the cancellation policy?",
    contentEn:
      "Cancellations more than 7 days before check-in receive a full deposit refund. Cancellations within 7 days of check-in are non-refundable.",
    contentAr:
      "الإلغاء قبل أكثر من 7 أيام من موعد الوصول يحصل على استرداد كامل للعربون. الإلغاء خلال 7 أيام من موعد الوصول غير مسترد.",
    sortOrder: 2,
  });

  await ensureKnowledgeEntry({
    propertyId: property.id,
    type: "LOCATION",
    contentEn: "Queens Garden Chalet is located in Nizwa, Oman.",
    contentAr: "يقع Queens Garden Chalet في نزوى، عُمان.",
    sortOrder: 3,
  });

  console.log("Knowledge base entries ready.");

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
