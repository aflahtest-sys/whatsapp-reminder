# Queens Garden AI

AI-powered customer service and reservation platform for **Queens Garden Chalet**, Nizwa, Oman.
Source of truth for what/how to build: `brief.md` and `architecture.md`.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript
- PostgreSQL + Prisma 7 (full schema from `architecture.md` §4)
- Auth.js (NextAuth v5) — credentials provider, JWT carrying `role` + `organizationId`
- Tailwind CSS v4, Arabic RTL / English LTR via a `locale` cookie
- Docker + docker-compose for local dev

## Status

- **Phase 0 — Foundation: done.** Auth, multi-tenant shell, RTL/LTR, Docker.
- **Phase 1 — Resort Management: done.** Property + photos + knowledge base CRUD with an
  owner-friendly, bilingual UI under **Dashboard → Resort Information**.
- Phase 2+ (calendar, pricing, reservations, AI, messaging, payments) not started.

## Local development (no Docker)

Requires PostgreSQL 16 running on `localhost:5432` with database/user `queensgarden` (see `.env`).

```bash
npm install            # runs prisma generate via postinstall
npm run db:migrate     # applies schema (enables btree_gist + no-overlap exclusion constraint)
npm run db:seed        # creates admin, org, property, owner, base pricing
npm run dev            # http://localhost:3000
```

Seeded accounts:

| Role            | Email                    | Password    |
| --------------- | ------------------------ | ----------- |
| Platform admin  | aflah@queensgarden.ai    | Admin@12345 |
| Org owner       | owner@queensgarden.ai    | Owner@12345 |

## Docker

```bash
docker compose up --build
```

Brings up Postgres (`:5432`) + app (`:3000`). The app runs `prisma migrate deploy` then seeds on start
(seed is idempotent). Requires `AUTH_SECRET` in `.env`.

## Verify Phase 0

```bash
npm run verify:phase0        # against http://localhost:3000 (add a base URL arg if different)
```

Checks: unauthenticated redirect to `/login`; admin signs in, lands on `/admin`, is bounced from
`/dashboard`; owner signs in, lands on `/dashboard` scoped to Queens Garden, is bounced from `/admin`.

## Verify Phase 1

```bash
npm run verify:phase1        # needs the production server running (npm run start)
```

Part A drives the real service layer (the code the server actions call): property update persists
and reads back, photo sync, knowledge entry create/update/delete, AI-facing fetch, and
cross-tenant rejection (a second org cannot touch Queens Garden data).
Part B signs in as the owner over HTTP and confirms `/dashboard/resort-info` renders the property,
facilities as chips, and the seeded knowledge base.

Manual check: sign in as `owner@queensgarden.ai` / `Owner@12345`, open **Resort Information**,
edit the property name/description, add/remove facility chips and a photo link, add/edit/delete an
FAQ in both languages, toggle the Arabic language button (العربية) and confirm everything renders
right-to-left.
