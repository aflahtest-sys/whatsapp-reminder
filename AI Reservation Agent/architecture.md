# Queens Garden AI — Technical Architecture Document

Version 1.0 — 2026-08-16
Companion to: *Queens Garden AI — Master Project Brief*

This document translates the master brief into concrete engineering decisions: database schema, core algorithms, auth model, AI tool contracts, and a phase-by-phase build plan. It is written to be handed to a code-generation tool (e.g. OpenCode) as the source of truth for implementation. Nothing here should be re-derived or re-decided by the coding tool — if a decision is missing, stop and ask rather than inventing one, per the brief's Section 30 development rules.

---

## 1. Guiding Constraints (from the brief, restated for engineering)

- One inventory unit per property: the whole chalet, not rooms. No room-level tables.
- Multi-tenant from day one: every table that holds business data is scoped to an `organization`, even though there's only one customer (Queens Garden) today.
- The client is never trusted for price, availability, deposit amount, booking status, payment status, or cancellation eligibility. Every one of those is computed server-side, on every request, from current database state.
- The AI never invents facts or computes numbers. It calls the same server-side functions the dashboard uses.
- Build in phases (Section 29 of the brief). This document is written phase-aware so a coding tool can implement one phase, stop, and verify before continuing.

---

## 2. Tech Stack (confirmed)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | Server components for dashboard, client components for interactive widgets (calendar, forms) |
| Backend | Next.js server actions / API routes | No separate backend service needed at this scale |
| Database | PostgreSQL | Needs `btree_gist` extension enabled (see §5.3) |
| ORM | Prisma | Schema below is Prisma-ready |
| Auth | Auth.js (NextAuth) with credentials provider | Session carries `role`, `organizationId` |
| AI | OpenAI API, function/tool calling | See §7 |
| Messaging | Meta WhatsApp Business Cloud API + Meta Instagram Messaging API | Phases 7–8 only |
| Payments | Manual "Mark Deposit Paid" first; Oman provider TBD | Phase 9 |
| Deployment | Docker, VPS/cloud | Phase 0 sets up the Dockerfile + docker-compose, not the deploy target |

---

## 3. Multi-Tenant Model

```
Platform (Aflah — platform admin)
 └── Organization (tenant, e.g. "Queens Garden")
      └── Property (e.g. "Queens Garden Chalet")
           ├── Reservations
           ├── Customers
           ├── Pricing Rules
           ├── Availability / Blocked Dates
           ├── Knowledge Base
           ├── Conversations / Messages
           └── Payments
```

Two access tiers, enforced in code, not just UI:

- **Platform admin** (`role = PLATFORM_ADMIN`): cross-organization access. Manages organizations, properties, AI configuration (OpenAI keys, prompts, model settings), WhatsApp/Instagram connections, system health, logs. Routes live under `/admin/*`.
- **Org users** (`role = ORG_OWNER | ORG_STAFF`): scoped strictly to their own `organizationId`. Everything under `/dashboard/*`. `ORG_OWNER` can manage pricing/resort info/staff; `ORG_STAFF` gets day-to-day operations (calendar, reservations, messages) — exact permission split is a Phase 0 config table, not hard-coded, so an owner can adjust it later without a code change.

**Rule for every query**: the `organizationId` (and, once multiple properties exist, `propertyId`) used to scope a database query always comes from the authenticated session — never from a client-supplied parameter. A thin `getScopedPrisma(session)` helper (or equivalent middleware) should make it structurally hard to write an unscoped query by accident.

---

## 4. Database Schema

Prisma-style definitions. Field types are indicative; adjust precision as needed (money fields should be `Decimal`, not `Float`).

```prisma
enum UserRole {
  PLATFORM_ADMIN
  ORG_OWNER
  ORG_STAFF
}

enum ReservationStatus {
  PAYMENT_PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
}

enum PaymentType {
  DEPOSIT
  BALANCE
  REFUND
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

enum PaymentMethod {
  MANUAL
  ONLINE
}

enum ConversationChannel {
  WHATSAPP
  INSTAGRAM
  WEB_CHAT
}

enum ConversationStatus {
  AI_HANDLING
  NEEDS_ATTENTION
  HUMAN_HANDLING
  CLOSED
}

enum MessageSender {
  CUSTOMER
  AI
  STAFF
}

enum ReservationSource {
  MANUAL
  WHATSAPP
  INSTAGRAM
  WEB_CHAT
}

enum KnowledgeType {
  FACILITY
  POLICY
  FAQ
  LOCATION
  CONTACT
  OTHER
}

enum IntegrationType {
  WHATSAPP
  INSTAGRAM
  OPENAI
  PAYMENT_PROVIDER
}

model Organization {
  id         String     @id @default(cuid())
  name       String
  slug       String     @unique
  status     String     @default("active") // active | suspended — for future billing
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  users       User[]
  properties  Property[]
}

model User {
  id             String        @id @default(cuid())
  email          String        @unique
  passwordHash   String
  name           String
  role           UserRole
  organizationId String?       // null for PLATFORM_ADMIN
  organization   Organization? @relation(fields: [organizationId], references: [id])
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}

model Property {
  id                    String   @id @default(cuid())
  organizationId        String
  organization          Organization @relation(fields: [organizationId], references: [id])
  name                  String
  slug                  String   @unique
  description           String   @db.Text
  addressText           String
  mapsUrl               String?
  latitude              Decimal? @db.Decimal(9, 6)
  longitude             Decimal? @db.Decimal(9, 6)
  maxGuests             Int
  bedrooms              Int
  beds                  Int
  bathrooms             Int
  facilities            Json     // structured list: [{ key, label_en, label_ar, icon }]
  checkInTime           String   // "15:00"
  checkOutTime          String   // "12:00"
  minStayNights         Int      @default(1)
  allowSameDayBooking   Boolean  @default(true)
  currency              String   @default("OMR")
  depositAmount         Decimal  @db.Decimal(10, 2) @default(50)
  cancellationRefundDays Int     @default(7) // >this many days before check-in = refundable
  status                String   @default("active")
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  images         PropertyImage[]
  pricingRules   PricingRule[]
  reservations   Reservation[]
  blockedDates   BlockedDate[]
  knowledgeBase  KnowledgeBaseEntry[]
  conversations  Conversation[]
  integrations   IntegrationCredential[]
}

model PropertyImage {
  id         String   @id @default(cuid())
  propertyId String
  property   Property @relation(fields: [propertyId], references: [id])
  url        String
  altText    String?
  sortOrder  Int      @default(0)
}

model PricingRule {
  id               String   @id @default(cuid())
  propertyId       String
  property         Property @relation(fields: [propertyId], references: [id])
  name             String   // "Normal", "Summer", "Ramadan", "Eid", "National Day", or custom
  pricePerNight    Decimal  @db.Decimal(10, 2)
  startDate        DateTime? @db.Date // null only allowed when isDefault = true
  endDate          DateTime? @db.Date
  priority         Int      // lower = higher priority when ranges overlap
  isDefault        Boolean  @default(false) // exactly one active default (Normal) per property
  isRecurringHijri Boolean  @default(false) // UI hint: "remember to update dates next year"
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([propertyId, startDate, endDate])
}

model Customer {
  id                 String   @id @default(cuid())
  organizationId     String
  name               String
  phone              String
  email              String?
  preferredLanguage  String   @default("en") // "ar" | "en"
  whatsappId         String?
  instagramId         String?
  notes              String?  @db.Text
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  reservations   Reservation[]
  conversations  Conversation[]

  @@unique([organizationId, phone])
}

model Reservation {
  id                  String             @id @default(cuid())
  propertyId          String
  property            Property           @relation(fields: [propertyId], references: [id])
  customerId          String
  customer            Customer           @relation(fields: [customerId], references: [id])
  checkIn             DateTime           @db.Date
  checkOut            DateTime           @db.Date
  guests              Int
  nights              Int
  priceBreakdown      Json               // snapshot: [{ date, season, pricePerNight }], immutable once created
  totalPrice          Decimal            @db.Decimal(10, 2)
  depositAmount       Decimal            @db.Decimal(10, 2)
  remainingBalance    Decimal            @db.Decimal(10, 2)
  status              ReservationStatus  @default(PAYMENT_PENDING)
  source              ReservationSource  @default(MANUAL)
  cancellationReason  String?
  depositRefundable   Boolean?           // set at cancellation time, computed server-side
  notes               String?            @db.Text
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  payments  Payment[]

  @@index([propertyId, checkIn, checkOut])
}

// Postgres-level safety net against double-booking, in addition to the
// application-level re-check-inside-transaction described in §5.3:
//   ALTER TABLE "Reservation" ADD CONSTRAINT no_overlapping_active_reservations
//   EXCLUDE USING gist (
//     "propertyId" WITH =,
//     daterange("checkIn", "checkOut") WITH &&
//   ) WHERE (status IN ('PAYMENT_PENDING', 'CONFIRMED'));
// Requires: CREATE EXTENSION IF NOT EXISTS btree_gist;

model BlockedDate {
  id         String   @id @default(cuid())
  propertyId String
  property   Property @relation(fields: [propertyId], references: [id])
  startDate  DateTime @db.Date
  endDate    DateTime @db.Date
  reason     String?
  createdBy  String   // userId
  createdAt  DateTime @default(now())
}

model Payment {
  id                 String        @id @default(cuid())
  reservationId      String
  reservation        Reservation   @relation(fields: [reservationId], references: [id])
  type               PaymentType
  amount             Decimal       @db.Decimal(10, 2)
  status             PaymentStatus @default(PENDING)
  method             PaymentMethod @default(MANUAL)
  providerReference  String?       // for future real payment provider
  verifiedBy         String?       // userId of staff who marked it paid
  paidAt             DateTime?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt
}

model KnowledgeBaseEntry {
  id          String        @id @default(cuid())
  propertyId  String
  property    Property      @relation(fields: [propertyId], references: [id])
  type        KnowledgeType
  question    String?       // used for FAQ entries
  contentEn   String        @db.Text
  contentAr   String        @db.Text
  isActive    Boolean       @default(true)
  sortOrder   Int           @default(0)
  updatedAt   DateTime      @updatedAt
}

model Conversation {
  id              String              @id @default(cuid())
  propertyId      String
  property        Property            @relation(fields: [propertyId], references: [id])
  customerId      String
  customer        Customer            @relation(fields: [customerId], references: [id])
  channel         ConversationChannel
  status          ConversationStatus  @default(AI_HANDLING)
  assignedStaffId String?
  lastMessageAt   DateTime            @default(now())
  createdAt       DateTime            @default(now())

  messages  Message[]
}

model Message {
  id                 String         @id @default(cuid())
  conversationId     String
  conversation       Conversation   @relation(fields: [conversationId], references: [id])
  sender             MessageSender
  senderUserId       String?        // set when sender = STAFF
  content            String         @db.Text
  language           String?        // "ar" | "en"
  externalMessageId  String?        // Meta's message id, for dedupe/webhook idempotency
  createdAt          DateTime       @default(now())
}

model IntegrationCredential {
  id             String          @id @default(cuid())
  propertyId     String
  property       Property        @relation(fields: [propertyId], references: [id])
  type           IntegrationType
  config         Json            // encrypted at the application layer before write
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}
```

Notes:
- `PricingRule.isDefault` marks the single fallback "Normal" rate (no `startDate`/`endDate`). All other rules must have concrete dates and a `priority`.
- `Reservation.priceBreakdown` is a **snapshot**. Pricing rules can change after a booking exists; the reservation must keep showing what the guest was actually charged.
- `IntegrationCredential.config` holds API keys/tokens — platform-admin-only, never exposed to org routes or client bundles.

---

## 5. Core Algorithms

### 5.1 Pricing engine — `calculate_booking_price(propertyId, checkIn, checkOut)`

Runs entirely server-side. Pure function of current `PricingRule` rows; never called from the client with a trusted result — always recomputed.

```
function calculate_booking_price(propertyId, checkIn, checkOut):
  assert checkIn < checkOut
  nights = dateDiffInDays(checkOut, checkIn)
  assert nights >= property.minStayNights

  rules = fetch active PricingRule rows for propertyId

  breakdown = []
  for each date d in [checkIn, checkOut):   # checkout night itself is not charged
      candidates = rules where (d is between startDate and endDate inclusive)
      if candidates is empty:
          rule = the single isDefault rule (Normal)
          if none exists: raise ConfigurationError("No default price configured")
      else:
          rule = candidates sorted by priority ascending, take first
      breakdown.append({ date: d, season: rule.name, pricePerNight: rule.pricePerNight })

  totalPrice = sum(item.pricePerNight for item in breakdown)
  deposit = property.depositAmount
  remainingBalance = totalPrice - deposit

  return { nights, breakdown, totalPrice, deposit, remainingBalance }
```

Priority convention (lower number wins): `Eid = 1`, `National Day = 2`, `Ramadan = 3`, `Summer = 4`, `Normal = 5 (default, no explicit priority needed since it's the fallback)`. Priorities are stored per rule, not hard-coded, so the owner can reorder them later.

Hijri seasons (Ramadan, Eid): stored as ordinary Gregorian `startDate`/`endDate` on a `PricingRule` row, flagged `isRecurringHijri = true` purely so the dashboard can prompt the owner ("Ramadan pricing needs updating for next year") — the calculation logic itself never computes Hijri dates.

### 5.2 Availability — `check_availability(propertyId, checkIn, checkOut)`

```
function check_availability(propertyId, checkIn, checkOut):
  blocked = query BlockedDate where propertyId matches AND daterange overlaps [checkIn, checkOut)
  if blocked not empty: return { available: false, reason: "blocked", ranges: blocked }

  conflicting = query Reservation where propertyId matches
                AND status IN (PAYMENT_PENDING, CONFIRMED)
                AND checkIn < requested.checkOut AND checkOut > requested.checkIn
  if conflicting not empty: return { available: false, reason: "booked", ranges: conflicting }

  return { available: true }
```

Calendar day states shown in the UI (`AVAILABLE`, `BOOKED`, `PAYMENT_PENDING`, `BLOCKED`) are derived at render time from `Reservation` + `BlockedDate`, not stored as their own per-day rows.

### 5.3 Booking creation — race-condition-safe

Two layers of protection, per the brief's "check availability again immediately before creating" rule (Section 10) plus the "never trust the client" rule (Section 31):

1. **Application layer**: `create_reservation` opens a DB transaction, re-runs `check_availability` and `calculate_booking_price` *inside* that transaction, and only then inserts the `Reservation` row.
2. **Database layer (backstop)**: a Postgres `EXCLUDE` constraint (see the commented SQL under the `Reservation` model in §4) makes a genuinely overlapping insert fail at the database level even under concurrent requests the app-layer check might race with. This is cheap insurance and should be added in Phase 2, not deferred.

### 5.4 Cancellation refund eligibility

```
function isDepositRefundable(checkInDate, now = today):
  return (checkInDate - now) > 7 days
```

Computed at the moment of cancellation and stored on `Reservation.depositRefundable` for the record — never computed in an AI prompt, never left for the frontend to decide.

---

## 6. Reservation & Payment State Machines

```
Reservation.status:
  PAYMENT_PENDING → CONFIRMED   (on payment verified)
  PAYMENT_PENDING → CANCELLED   (guest/staff cancels before paying, or timeout policy — TBD)
  CONFIRMED       → CANCELLED   (cancellation, refund eligibility computed per §5.4)
  CONFIRMED       → COMPLETED   (after checkout date passes, e.g. nightly job)

Payment.status:
  PENDING → PAID       (staff clicks "Mark Deposit Paid", or provider webhook in Phase 9)
  PENDING → FAILED
  PAID    → REFUNDED
```

A reservation only becomes `CONFIRMED` once its deposit `Payment` is `PAID` — this transition should be the single choke point that flips reservation status, so manual marking and future webhook-driven marking both go through the same code path.

---

## 7. AI Agent Tool Contracts

The AI is a tool-calling agent, not a prompt-only chatbot (brief §11–12). Every tool below is a thin wrapper around the exact same service functions the dashboard calls — there is no separate "AI version" of pricing or availability logic.

```ts
check_availability(propertyId: string, checkIn: string, checkOut: string):
  { available: boolean; reason?: "blocked" | "booked" }

calculate_price(propertyId: string, checkIn: string, checkOut: string):
  { nights: number; breakdown: { date: string; season: string; pricePerNight: number }[];
    totalPrice: number; deposit: number; remainingBalance: number }

create_reservation(propertyId: string, customerId: string, checkIn: string, checkOut: string, guests: number):
  { reservationId: string; status: "PAYMENT_PENDING"; totalPrice: number; deposit: number; remainingBalance: number }
  // internally re-validates availability + guests <= maxGuests + recalculates price — see §5.3

get_reservation(reservationId?: string, customerPhone?: string):
  Reservation | Reservation[]

modify_reservation(reservationId: string, changes: { checkIn?: string; checkOut?: string; guests?: number }):
  { success: boolean; updatedReservation?: Reservation; conflict?: {...} }
  // re-runs availability + pricing for the new dates before committing

cancel_reservation(reservationId: string, reason?: string):
  { success: boolean; depositRefundable: boolean }

create_payment_request(reservationId: string):
  { instructions: string; amount: number; method: "manual" | "online" }
  // Phase 4-9: manual instructions text; later a real payment link

handover_to_staff(conversationId: string, reason: string):
  { success: boolean }
  // sets Conversation.status = NEEDS_ATTENTION, AI stops responding until staff returns control
```

Guardrails to encode in the AI's system prompt (not in this document's logic, but noted here so OpenCode wires it correctly):
- The model must call a tool for anything factual (availability, price, policy, facilities) — it must never state a number or fact without a corresponding tool result in context.
- Knowledge-base questions (facilities, policies, FAQs) are answered by fetching `KnowledgeBaseEntry` rows for the property, not from the model's general knowledge.
- Trigger `handover_to_staff` on: discount requests, complaints, anything outside configured rules, model uncertainty, or an explicit request for a human (brief §17).
- Language: detect the customer's language per message and respond in kind (Arabic or English); this is a per-turn decision, not a fixed session setting.

---

## 8. Folder / Project Structure

```
/app
  /(dashboard)/...        org staff routes: calendar, reservations, customers, messages, pricing, resort-info, settings
  /(admin)/...             platform admin routes: organizations, properties, integrations, AI config, logs
  /(internal-chat)/...      Phase 5 internal test chat UI (never shipped to guests)
  /api
    /webhooks/whatsapp/route.ts
    /webhooks/instagram/route.ts
    /auth/...
/lib
  /db/                     Prisma client singleton
  /services/
    pricing.ts             calculate_booking_price
    availability.ts        check_availability
    reservations.ts        create/modify/cancel_reservation
    payments.ts            mark-paid, refund logic
    knowledgeBase.ts        resort info CRUD + AI-facing fetch
  /ai/
    agent.ts                agent loop / tool dispatch
    tools/                  one file per tool in §7, each calling /lib/services
    prompts/
  /auth/                   session helpers, role guards, getScopedPrisma
/prisma
  schema.prisma
  seed.ts                  seeds Queens Garden org/property/pricing for local dev
/components                shared UI (calendar, cards, status badges — Arabic RTL aware)
/types
```

Key rule for the coding tool: **all business logic lives in `/lib/services`**, called identically by dashboard server actions, AI tools, and (later) webhook handlers. Nothing computes price or availability inline inside a route handler or React component.

---

## 9. Phase-by-Phase Build Plan

Mirrors brief Section 29, made concrete against the schema above. Each phase has a definition of done; do not start the next phase until the current one's DoD is met (brief §30).

**Phase 0 — Foundation.** Next.js + TypeScript scaffold, Postgres + Prisma (schema above, minus AI/messaging tables if you want to add those later — but simplest is to create the full schema now since it's already designed), Auth.js with the three roles, base layout with Arabic RTL / English LTR support, Docker + docker-compose for local dev. *DoD: can log in as a seeded platform admin and a seeded org owner, land on empty dashboard shells, both correctly scoped.*

**Phase 1 — Resort Management.** `Property`, `PropertyImage`, `KnowledgeBaseEntry` CRUD, dashboard screens for resort info (§25 of the brief). *DoD: owner can edit every field listed in brief §3/§13 through the UI, no direct DB access needed.*

**Phase 2 — Calendar & Availability.** `BlockedDate`, `check_availability`, calendar UI (available/booked/payment-pending/blocked), the Postgres exclusion constraint from §5.3. *DoD: automated tests prove overlapping bookings are rejected even under concurrent attempts; staff can block/unblock dates from the UI.*

**Phase 3 — Pricing Engine.** `PricingRule` CRUD + `calculate_booking_price` per §5.1, dashboard pricing screen with priority ordering. *DoD: a cross-season date range (e.g. 29 Apr → 2 May from the brief's own example) returns the correct per-night breakdown and total in a test.*

**Phase 4 — Reservation Management.** `Customer`, `Reservation`, `Payment`, manual booking creation/edit/cancel, "Mark Deposit Paid", reservations list/search UI. *DoD: a staff member can run the entire booking lifecycle by hand with no AI involved — this is the brief's "first milestone" (§35).*

**Phase 5 — AI Agent.** OpenAI integration, tools from §7, internal web chat only (no WhatsApp/Instagram yet). *DoD: a text conversation in the internal chat can complete a full booking end to end, in both Arabic and English, using only tool-returned data.*

**Phase 6 — Knowledge Base for AI.** Wire `KnowledgeBaseEntry` into the agent's context/RAG so it answers facility/policy/FAQ questions only from configured data. *DoD: asking about something not in the knowledge base triggers a graceful "let me check" / handover rather than a fabricated answer.*

**Phase 7 — WhatsApp.** Meta WhatsApp Business Cloud API webhook, `Conversation`/`Message` wiring, dedupe via `externalMessageId`. *DoD: real WhatsApp round-trip booking, Arabic and English, with staff handover working.*

**Phase 8 — Instagram.** Meta Instagram Messaging API webhook, reusing the exact same agent/service layer. *DoD: same booking flow proven over Instagram DMs.*

**Phase 9 — Payments.** Formalize `Payment` status transitions, prep for a real Oman payment provider (webhook receiver stubbed even before a provider is chosen). *DoD: payment states match §Payment.status exactly; manual flow still works as the fallback.*

**Phase 10 — Production Hardening.** Rate limiting, structured logging, error handling/alerting, backups, deployment docs. *DoD: a documented, repeatable deploy; a documented backup/restore procedure.*

---

## 10. Explicit Non-Goals (for now)

Per brief §34 — keep the schema/architecture extensible for these, but do not build them yet: multiple properties per organization actually in use (the schema already supports it, just only one row will exist), automated reminders, review requests, promotional campaigns, full CRM/analytics, AI sales recommendations, subscription billing. Do not let any phase above balloon into building these early.

---

## 11. Open Questions for the Resort Owner / Aflah (resolve before or during Phase 3–4)

- Exact staff permission split between `ORG_OWNER` and `ORG_STAFF` (who can edit pricing vs. just view it, etc.).
- What happens to a `PAYMENT_PENDING` reservation that never gets paid — does it auto-expire and release the dates, and after how long?
- Whether `COMPLETED` is set automatically by a scheduled job after checkout, or manually by staff.
- Final choice of Oman payment provider (Phase 9 — not blocking earlier phases).
