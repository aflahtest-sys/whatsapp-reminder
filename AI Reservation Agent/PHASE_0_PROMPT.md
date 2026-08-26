# Phase 0 kickoff prompt — paste this into OpenCode

Use this as your first message to OpenCode inside this project folder. It scopes OpenCode to Phase 0 only, points it at the two reference docs, and states the definition of done so it knows when to stop and wait for you rather than continuing on to Phase 1 on its own.

---

```
This project is the "Queens Garden AI" hospitality reservation platform.
Read these two files first, fully, before writing any code:

  - brief.md          (the product/business requirements — the source of truth for WHAT to build)
  - architecture.md   (the technical design — the source of truth for HOW to build it: DB schema,
                        algorithms, folder structure, and the phase-by-phase plan in section 9)

Do not deviate from the schema, algorithms, or folder structure in architecture.md. If something
is ambiguous or missing, stop and ask me rather than guessing or inventing behavior — this applies
especially to pricing, availability, and payment logic (see architecture.md section "Guiding
Constraints" and brief.md section 31).

Your task right now is ONLY Phase 0 — Foundation, as described in architecture.md section 9.
Do not start Phase 1 or any later phase, and do not implement AI or messaging integrations yet.

Build:
- Next.js (App Router) + TypeScript project scaffold
- PostgreSQL + Prisma, using the full schema from architecture.md section 4
- Auth.js (NextAuth) with the three roles (PLATFORM_ADMIN, ORG_OWNER, ORG_STAFF) from
  architecture.md section 3
- A base layout with Arabic RTL / English LTR support
- Docker + docker-compose for local development (app + Postgres)
- A Prisma seed script that creates: one platform admin user, one organization ("Queens Garden"),
  one property ("Queens Garden Chalet") with the real details from brief.md section 3-4, and one
  org owner user for it

Definition of done for this phase (do not proceed past this without checking with me):
- `docker-compose up` brings up the app and database cleanly
- I can log in as the seeded platform admin and land on an empty admin shell
- I can log in as the seeded org owner and land on an empty dashboard shell, correctly scoped to
  their organization (no cross-tenant data visible)
- No AI, WhatsApp, Instagram, or payment code exists yet — those come in later phases

When you believe Phase 0 is done, show me how to verify it (exact commands to run, URLs to open,
and what I should see), then stop and wait for me before touching Phase 1.
```
