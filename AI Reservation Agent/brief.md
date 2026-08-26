# Queens Garden AI — Master Project Brief

## 1. Project Overview

We are building an AI-powered customer service and reservation platform for **Queens Garden Chalet**, a whole-property vacation chalet in Nizwa, Oman.

The person building this system is Aflah. Aflah is building the platform for a customer who owns/runs the resort, so the application must be extremely user-friendly for non-technical resort staff.

This should **NOT** be treated as a simple chatbot. The final product is a complete hospitality management and AI reservation system capable of:

- Answering customer questions
- Handling Arabic and English conversations
- Checking real availability
- Calculating exact booking prices
- Creating reservations
- Managing cancellations/modifications
- Handling the OMR 50 deposit
- Communicating with customers through WhatsApp
- Communicating with customers through Instagram
- Handing conversations over to human staff
- Providing a simple staff dashboard
- Managing resort information and pricing
- Eventually supporting multiple resorts/customers using the same platform

## 2. Important Product Principle

The chalet is rented as one complete property. There are **no individual room reservations**. The entire resort/chalet is the inventory unit.

```
Queens Garden Chalet
    ↓
Available / Booked / Blocked / Unavailable
```

There is no room-level inventory management. The chalet can have up to 20 guests.

## 3. Business Information

**Property**
- Name: Queens Garden Chalet
- Location: Nizwa, Oman
- Google Maps: https://www.google.com/maps/place/%D8%A7%D8%B3%D8%AA%D8%B1%D8%A7%D8%AD%D8%A9+Queens+Garden+Chalet%E2%80%AD/@22.9840903,57.5571313,1004m/
- Instagram: https://www.instagram.com/p/C93t5PvqH2L/
- Airbnb: https://www.airbnb.com/rooms/1210935820382675946

Known property information:
- 7 bedrooms, 20 beds, 10 bathrooms
- Swimming pool
- Kitchen
- Wi-Fi
- Parking
- Family-oriented accommodation
- Maximum 20 guests

Use the customer's configured resort information as the authoritative source for AI responses. Do NOT allow the AI to invent facilities, policies, prices, availability, or other business information.

## 4. Booking Rules

- Whole chalet booking
- Maximum guests: 20
- Minimum stay: 1 night
- Same-day bookings: Allowed
- Check-in: 3:00 PM
- Check-out: 12:00 PM

**Deposit**: OMR 50, required to confirm the reservation. Initially payment can be mocked/manual — dashboard needs a "Mark Deposit Paid" action. Later, integrate a real Oman payment provider.

## 5. Cancellation Policy

- More than 7 days before check-in → deposit refundable
- Within 7 days of check-in → deposit non-refundable

The system must calculate this automatically based on the reservation's check-in date. Do not hard-code this into AI prompts — the backend must enforce the rule.

## 6. Pricing

| Season | Price/night | Date range |
|---|---|---|
| Normal | OMR 160 | (fallback/default) |
| Summer | OMR 120 | 1 May → 30 July |
| Ramadan | OMR 55 | 1 Ramadan → 30 Ramadan |
| Eid | OMR 180 | 1 day before Eid → 1 day after Eid |
| National Day | OMR 180 | First day → last day |

## 7. Seasonal Pricing Architecture

Seasonal pricing must NOT be hard-coded into application logic. The resort owner should be able to manage pricing through the dashboard. Hijri-based seasons such as Ramadan and Eid should be configurable every year — do not permanently hard-code Hijri dates.

**Pricing priority when seasons overlap:**
1. Eid
2. National Day
3. Ramadan
4. Summer
5. Normal

The backend determines the applicable price. The AI must NEVER calculate pricing itself.

## 8. Multi-Night Pricing

Each night must be calculated independently — do NOT simply multiply the current night's price by the number of nights.

Example, 29 April → 2 May:
```
29 Apr = Normal = 160
30 Apr = Normal = 160
01 May = Summer = 120
Total = OMR 440
```

Create a deterministic backend function `calculate_booking_price(check_in, check_out)` that returns: number of nights, price per night, applicable season for each night, total, deposit, remaining balance.

## 9. Availability

Availability is date-range based. The system must prevent overlapping confirmed reservations.

Example:
```
20 Aug → BOOKED
21 Aug → BOOKED
22 Aug → AVAILABLE
```

Statuses to support: `AVAILABLE`, `PAYMENT_PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, `BLOCKED`.

Staff must be able to manually block dates (e.g. "27 Aug → BLOCKED, Reason: Owner use"). The AI should automatically treat blocked dates as unavailable.

## 10. Reservation Flow

Example: Customer says "Hi, I want to book tomorrow for 8 people."

1. Determine the dates.
2. Confirm dates if ambiguous.
3. Check availability.
4. Check guest count <= 20.
5. Calculate exact price.
6. Explain deposit.
7. Ask for confirmation.
8. Create a pending reservation.
9. Send payment instructions/payment link.
10. Confirm booking only after payment is verified.

```
PAYMENT_PENDING → PAYMENT_RECEIVED → CONFIRMED
```

The backend must check availability again immediately before creating/confirming the booking to prevent double booking.

## 11. AI Agent

The AI should be an actual agent connected to backend tools — NOT a prompt-only chatbot. Required tools/functions (approximately):

```
check_availability()
calculate_price()
create_reservation()
get_reservation()
modify_reservation()
cancel_reservation()
create_payment_request()
handover_to_staff()
```

The exact implementation can be decided during development.

## 12. Critical AI Rule

The AI must never independently invent: availability, prices, booking status, payment status, cancellation results, resort facilities, or policies. The AI must use backend tools or the configured knowledge base.

## 13. Knowledge Base

The AI should have access to configurable resort information: description, facilities, bedrooms/beds/bathrooms, pool, kitchen, Wi-Fi, parking, max guests, check-in/out, location, rules, cancellation policy, pricing info, FAQs, contact info, and any additional info the owner adds. The resort owner should be able to edit this through the dashboard. Do not expose technical AI configuration to resort staff.

## 14. Languages

The AI must support Arabic + English, automatically responding in the customer's language. Design for Arabic RTL and English LTR.

## 15. WhatsApp

Integrate with Meta WhatsApp Business Cloud API:
```
Customer → WhatsApp → Meta API → Backend → AI Agent → Booking/Knowledge Tools → Response → WhatsApp
```
Uses the same AI and reservation system as Instagram.

## 16. Instagram

Integrate with Meta Instagram Messaging API. Instagram must use the same AI, customer database, knowledge base, availability engine, pricing engine, reservation system, and human handoff system. Do NOT build two independent chatbots.

## 17. Human Handoff

Mandatory. If the AI cannot safely handle something, it transfers to staff — e.g. discount requests, complaints, requests outside configured rules, AI uncertainty, or explicit request for a human. Staff can click "Take Over Conversation"; AI stops responding, staff can continue, and can later return control to AI.

## 18. Dashboard Philosophy

The dashboard is for the resort customer/staff, NOT the developer. It must be extremely easy to use, clean, modern, friendly, mobile/tablet/desktop responsive, non-technical, minimal clutter, with clear visual status. The owner should immediately understand: what's booked, what's available, who's coming, who's paid, who needs to pay, what customers are asking, what requires attention.

Do NOT expose to normal resort staff: API keys, OpenAI model settings, temperature, tokens, vector database settings, webhook configuration, database controls, developer logs.

## 19. Staff Dashboard

Suggested navigation: Dashboard, Calendar, Reservations, Customers, Messages, Pricing, Resort Information, Settings.

## 20. Dashboard Home

Should show: today's status, next booking, upcoming bookings, pending payments, messages requiring attention, quick actions (+ New Booking, Calendar, Messages).

## 21. Calendar

One of the main screens. Clearly shows available/booked/payment pending/blocked. Clicking a booking opens its details. Staff can view/edit/cancel/create booking/block dates.

## 22. Reservations

Human-readable, not database-like. Each reservation shows: customer, phone, check-in, check-out, guests, total, deposit, remaining amount, payment status, booking status, notes. Support search and filtering.

## 23. Messages

Staff see conversations from WhatsApp and Instagram, with status like "AI replied", "Needs attention", "Human required". Staff can open the full conversation and take over.

## 24. Pricing Management

Owner can modify: normal price, summer price/date, Ramadan price/date, Eid price/date, National Day price/date, add future seasons, change priority. No developer intervention needed for normal pricing changes.

## 25. Resort Information Management

Owner can edit: resort name, description, facilities, max guests, check-in/out, rules, location, contact info, FAQs, policies. Changes become available to the AI knowledge system.

## 26. Two-Level Administration

Multi-tenant from the beginning.

**Resort Staff** can access: Dashboard, Calendar, Reservations, Customers, Messages, Pricing, Resort information, Basic settings.

**Platform Administrator (Aflah)** can access: Organizations/customers, Resorts/properties, AI configuration, WhatsApp connections, Instagram connections, OpenAI configuration, System health, Logs, Errors, Integrations, Usage, Future subscription/billing.

The resort customer should not see developer/admin functionality.

## 27. Multi-Tenant Architecture

Designed so more resorts can be added later — database designed around organizations/properties rather than one hard-coded resort. Potential core entities: organizations, users, properties, customers, reservations, availability, pricing_rules, conversations, messages, payments, knowledge_base, settings.

## 28. Technology Stack

- Frontend: Next.js, TypeScript, modern responsive UI
- Backend: Next.js server/API routes or Node.js backend
- Database: PostgreSQL
- ORM: Prisma
- AI: OpenAI API
- Messaging: Meta WhatsApp Business Cloud API, Meta Instagram Messaging API
- Payments: Oman payment provider, to be selected later
- Deployment: Docker, VPS/cloud server

Production-ready but not unnecessarily complicated.

## 29. Development Strategy

DO NOT build everything at once. First design the entire architecture, then implement it phase by phase.

- **Phase 0 — Foundation**: Next.js, TypeScript, PostgreSQL, Prisma, authentication, multi-tenant structure, UI system, environment configuration, Docker setup. No AI or messaging integrations yet.
- **Phase 1 — Resort Management**: Resort information, facilities, rules, policies, check-in/out, max guests, contact info, location, images, dashboard.
- **Phase 2 — Calendar & Availability**: Calendar, availability, booked/blocked dates, manual reservations, conflict prevention, same-day bookings, guest limit. Test heavily — must never allow overlapping bookings.
- **Phase 3 — Pricing Engine**: Deterministic pricing (Normal 160, Summer 120, Ramadan 55, Eid 180, National Day 180), configurable dates/priorities. Test cross-season bookings.
- **Phase 4 — Reservation Management**: Customers, reservations, create/edit/cancel, deposit, payment status, booking status, history, notes. At the end, the resort should have a usable manual reservation system even without AI.
- **Phase 5 — AI Agent**: Connect OpenAI, implement tools (check_availability, calculate_price, create_reservation, get_reservation, modify_reservation, cancel_reservation, handover_to_staff). Test via internal web chat only, no WhatsApp yet.
- **Phase 6 — Knowledge Base**: Add resort knowledge; test facilities/policies/location/check-in-out/FAQs/rules. AI must answer only from trusted configured information.
- **Phase 7 — WhatsApp**: Connect Meta WhatsApp Business Cloud API. Test incoming messages, AI replies, Arabic, English, booking, availability, human handoff.
- **Phase 8 — Instagram**: Connect Instagram Messaging API, reusing the exact same AI and backend. Test the complete Instagram booking flow.
- **Phase 9 — Payments**: Start with "Mark Deposit Paid", then integrate the selected Oman payment provider. States: Payment Pending, Payment Received, Payment Failed, Refunded. Use payment webhooks where supported.
- **Phase 10 — Production Hardening**: Security, authentication, authorization, backups, logging, error handling, rate limiting, monitoring, webhook reliability, database backup, AI failure handling, human handoff, deployment, documentation.

## 30. Development Rules

OpenCode must NOT generate the entire system blindly in one step. For every phase: (1) understand the architecture, (2) implement the current phase only, (3) run/build/test it, (4) fix errors, (5) verify the phase, (6) only then proceed to the next phase.

Do not break existing functionality when implementing later phases. Keep the code modular and maintainable. Use clear naming. Use proper validation. Use server-side authorization. Never trust client-side pricing or availability. All critical business rules must be enforced on the backend.

## 31. Most Important Security Rule

The client/browser must never be trusted for: price, availability, deposit amount, booking status, payment status, cancellation eligibility. These must always be validated server-side.

## 32. Example AI Booking Conversation

**Arabic**: "السلام عليكم، أريد أحجز الشاليه من الخميس إلى السبت." — AI should determine the dates, confirm if necessary, check availability, calculate the exact price, ask the number of guests, verify <=20, explain the OMR 50 deposit, and proceed to reservation.

**English**: "Hi, I want to book the chalet from Thursday to Saturday." — Same process.

The customer should experience a natural conversation, not a complicated form.

## 33. Important UX Principle

The application should feel like a polished commercial product. Avoid: developer-looking dashboards, excessive tables, technical terminology, too many buttons, unnecessary configuration, complex navigation, long forms.

Prefer: cards, clear statuses, simple actions, calendar, search, visual indicators, confirmation dialogs, friendly empty states, responsive design, Arabic RTL support, English LTR support.

## 34. Future Possibilities

Do not implement yet, but keep the architecture extensible for: multiple resorts, multiple properties per customer, online payment, automated reminders, check-in reminders, review requests, promotional campaigns, customer CRM, analytics, revenue reports, AI sales recommendations, WhatsApp templates, Instagram lead tracking, subscription billing for resort customers.

## 35. First Goal

The first milestone is NOT the AI. The first milestone is: a beautiful, simple, reliable resort management dashboard with a working calendar, availability system, pricing engine, and manual reservations. Once that is solid, add the AI. Once the AI is solid, connect WhatsApp and Instagram. Once the booking flow is proven, connect payments. This approach reduces risk and makes debugging much easier.

## Final Product Vision

A customer sends "Hi, is the resort available this weekend?" via WhatsApp/Instagram → AI Agent → Check Availability → Calculate Exact Price → Ask Guest Count → Confirm Booking → Request OMR 50 Deposit → Verify Payment → Confirm Reservation → Send Confirmation.

Meanwhile resort staff open a simple dashboard and immediately see: today's bookings, availability, upcoming reservations, pending payments, customer messages, AI conversations, calendar.

The system should be easy enough that a non-technical resort employee can use it without needing Aflah or a developer for everyday operations.
