# Queens Garden AI — Full System E2E Test Plan

**Scope:** Phases 0–5 integrated. Tests dashboard + AI booking flow, both English and Arabic, end-to-end.

**Setup:** `npm run dev` running at http://localhost:3000, database seeded with Queens Garden org/property/pricing/sample KB entries.

Test users:
- Platform admin: `aflah@queensgarden.ai` / `Admin@12345`
- Org owner: `owner@queensgarden.ai` / `Owner@12345`

---

## Part A: Dashboard Staff Flow (Manual + Automated)

### A1. Staff Login & Dashboard Home
- [ ] Log in as owner (`owner@queensgarden.ai`)
- [ ] Land on `/dashboard` (not `/admin`)
- [ ] Dashboard shows: Queens Garden Chalet, availability status, next booking, pending payments, quick actions
- **Verify:** org isolation (no other orgs visible), RTL toggle works

### A2. Resort Information Editing
- [ ] Navigate to Resort Information
- [ ] Edit property name (add " - Test Edit" suffix), save
- [ ] Add a facility chip (e.g. "Hot Tub"), save
- [ ] Add a new FAQ entry in English: "Can I bring pets?" / "No"
- [ ] Add the same FAQ in Arabic
- [ ] Reload page, verify all edits persisted
- **Verify:** changes visible immediately, no console errors

### A3. Pricing Management
- [ ] Navigate to Pricing
- [ ] View default Normal rule (OMR 160)
- [ ] Add a custom season "Holiday Promo": OMR 90, dates 15 Dec → 31 Dec, priority 2
- [ ] Reorder priorities (drag or interface), save
- [ ] Verify the rule persists on reload
- **Verify:** pricing list shows all 4 rules (Normal + Summer + Ramadan + your new rule)

### A4. Calendar & Availability
- [ ] Navigate to Calendar
- [ ] View current month, see AVAILABLE days (all blue/green)
- [ ] Click a date range and block it: "Test Block — Maintenance", save
- [ ] Calendar now shows BLOCKED state for those dates
- [ ] Unblock the dates, verify calendar returns to AVAILABLE
- **Verify:** blocked dates prevent new reservations (tested in A7 below)

### A5. Customers Page
- [ ] Navigate to Customers
- [ ] Seeded data should show at least 1 test customer (if any from seed)
- [ ] Click "Add Customer" (or use the button)
- [ ] Create a new customer: "Ahmed" / "+968 9123 4567" / Preferred language: Arabic
- [ ] Save, verify customer appears in the list
- [ ] Click the customer row, see (empty) reservations list
- **Verify:** customer search works, customer ID is generated

### A6. Manual Reservation Creation (Staff)
- [ ] Navigate to Reservations
- [ ] Click "Create New Reservation"
- [ ] Pick customer "Ahmed" (from A5)
- [ ] Pick dates: tomorrow → day after tomorrow (2 nights)
- [ ] Fill guests: 4
- [ ] Click "Recalculate Price" (or auto-calculate)
- [ ] Should show breakdown: "Night 1: OMR 160, Night 2: OMR 160, Total: OMR 320, Deposit: OMR 50, Remaining: OMR 270"
- [ ] Click "Create Reservation"
- [ ] Reservation now shows status: PAYMENT_PENDING
- [ ] **DO NOT MARK DEPOSIT PAID YET** (testing AI flow next)
- **Verify:** price is correct for the dates, reservation ID is generated

### A7. Calendar Reflection
- [ ] Go back to Calendar
- [ ] Your newly created reservation dates should now show PAYMENT_PENDING (orange/yellow)
- [ ] Verify blocked dates from A4 still show BLOCKED (red)
- [ ] Verify remaining dates still show AVAILABLE
- **Verify:** calendar reflects real reservation state

### A8. Deposit Payment (Manual)
- [ ] Go back to Reservations, click the reservation from A6
- [ ] Click "Mark Deposit Paid"
- [ ] Reservation status changes to CONFIRMED
- [ ] Go back to Calendar — those dates now show BOOKED (blue)
- **Verify:** payment state machine works (PENDING → CONFIRMED), calendar updates

---

## Part B: AI Booking Flow — English (Internal Chat)

### B1. Start AI Chat
- [ ] Navigate to `/dashboard/ai-chat` (or "AI Chat" from the menu)
- [ ] Chat interface loads with empty history
- [ ] Input field is ready
- [ ] Language is English (default)
- **Verify:** no console errors, chat ready to receive input

### B2. AI Availability Check
- [ ] Customer message: "Is the chalet available 5 days from now for 3 nights?"
- [ ] AI should:
  - [ ] Understand the date range (compute 5 days out to +5+3 days)
  - [ ] Call `check_availability` (shown inline: "[Checking availability...]")
  - [ ] Return availability status
  - [ ] Show tool result inline: "[Availability: Available ✓]"
- [ ] AI responds naturally: "Yes, the chalet is available from [date] to [date]."
- **Verify:** tool call is visible, response is factual (not made up)

### B3. AI Price Calculation
- [ ] Continuing the same chat: Customer asks "What's the price for those dates?"
- [ ] AI should:
  - [ ] Call `calculate_price` with the inferred dates
  - [ ] Show tool result: "[Price calculation: OMR XXX total, OMR 50 deposit]"
  - [ ] Break down the price: "Night 1: OMR 160, Night 2: OMR 160, Night 3: OMR 160, Total: OMR 480, Deposit: OMR 50"
- [ ] AI asks: "Would you like to proceed with the booking?"
- **Verify:** price matches what staff saw in A6, breakdown is per-night, deposit is correct

### B4. AI Booking Creation
- [ ] Customer message: "Yes, book it for 2 people"
- [ ] AI should:
  - [ ] Recognize 2 people (<=20, OK)
  - [ ] Call `create_reservation` with the inferred customer info (or ask for name/phone first)
  - [ ] Show: "[Reservation created: Reservation ID xxxxx]"
  - [ ] Status: PAYMENT_PENDING
  - [ ] AI confirms: "Your booking is confirmed! Reservation ID: xxxxx. Deposit: OMR 50 required. Please send payment to [instructions]."
- **Verify:** reservation is created and visible in staff dashboard (A6 flow but created by AI)

### B5. AI Knowledge Base Query
- [ ] Customer message: "What's your cancellation policy?"
- [ ] AI should:
  - [ ] Fetch KnowledgeBaseEntry (type=POLICY or FAQ mentioning cancellation)
  - [ ] Show: "[Knowledge: Cancellation policy — more than 7 days before check-in: refundable]"
  - [ ] Respond in natural English: "Deposits are refundable if you cancel more than 7 days before check-in."
- **Verify:** AI is fetching KB, not making up the policy

### B6. AI Handover Trigger
- [ ] Customer message: "Can you give me a 20% discount?"
- [ ] AI should:
  - [ ] Recognize this is outside its authority
  - [ ] Call `handover_to_staff` 
  - [ ] Show: "[Handover requested: Discount negotiation]"
  - [ ] Say: "I'll connect you with a staff member who can discuss discounts. One moment..."
  - [ ] Chat status changes to NEEDS_ATTENTION or HUMAN_HANDLING
- [ ] Staff can see the chat is flagged, click "Take Over"
- [ ] Staff replies directly to the chat (AI is now paused)
- [ ] Staff offers "15% discount" or declines
- [ ] Staff clicks "Release to AI" (or similar) — AI resumes control
- **Verify:** handover works, staff can take control, AI can be released

---

## Part C: AI Booking Flow — Arabic (Internal Chat)

### C1. Language Toggle
- [ ] In the AI Chat, toggle language to العربية (Arabic)
- [ ] UI flips to RTL
- [ ] Chat clears (fresh conversation, or translation option TBD based on implementation)
- **Verify:** RTL layout works, chat is ready for Arabic input

### C2. AI Availability Check (Arabic)
- [ ] Customer message: "هل الشاليه متاح بعد غد لمدة 3 ليالي؟" (Is the chalet available the day after tomorrow for 3 nights?)
- [ ] AI should:
  - [ ] Understand the Arabic date reference (day after tomorrow)
  - [ ] Call `check_availability`
  - [ ] Respond **in Arabic**: "نعم، الشاليه متاح من [التاريخ] إلى [التاريخ]" (Yes, the chalet is available from [date] to [date])
- **Verify:** AI detects Arabic input, responds in Arabic, tool calls work the same

### C3. AI Price Calculation (Arabic)
- [ ] Customer: "كم سعر الحجز؟" (What's the booking price?)
- [ ] AI should:
  - [ ] Call `calculate_price`
  - [ ] Respond in Arabic with breakdown: "السعر الإجمالي: ريال عماني 480، الإيداع المطلوب: ريال عماني 50"
  - [ ] Per-night: "الليلة الأولى: 160 ريال، الليلة الثانية: 160 ريال، الليلة الثالثة: 160 ريال"
- **Verify:** Arabic numbers/currency shown correctly, no mixed EN/AR

### C4. AI Booking (Arabic)
- [ ] Customer: "حسناً، أحجز الشاليه لشخصين" (OK, book the chalet for 2 people)
- [ ] AI should:
  - [ ] Call `create_reservation`
  - [ ] Respond in Arabic: "تم تأكيد حجزك. رقم الحجز: xxxxx. الإيداع المطلوب: ريال عماني 50"
- [ ] Reservation appears in staff dashboard
- **Verify:** Arabic reservation flow end-to-end, same business logic as English

### C5. Arabic Knowledge Base
- [ ] Customer: "ما هي سياسة الإلغاء؟" (What's the cancellation policy?)
- [ ] AI fetches knowledge base entry and responds in Arabic
- **Verify:** KB entries work in both languages

---

## Part D: Cross-Verify Dashboard & AI Consistency

### D1. Reservation Visibility
- [ ] Staff creates a reservation via AI (Part B, B4)
- [ ] Go to Dashboard → Reservations
- [ ] That reservation appears in the staff list
- [ ] Details match exactly: dates, guests, price, deposit, status
- **Verify:** single source of truth (no divergence between AI and dashboard)

### D2. Payment Consistency
- [ ] AI creates a reservation (status: PAYMENT_PENDING)
- [ ] Staff dashboard shows it as PAYMENT_PENDING
- [ ] Staff clicks "Mark Deposit Paid"
- [ ] AI chat (if still open) should reflect the status (or re-check if a new query is made)
- [ ] Calendar shows BOOKED
- **Verify:** all layers (DB, AI, dashboard) agree on state

### D3. Double-Booking Prevention
- [ ] AI chat 1: create a reservation for dates 10–12 Oct, 2 people
- [ ] Immediately, AI chat 2: try to create a reservation for dates 11–13 Oct (overlap)
- [ ] Second request should fail: "[Error: Dates unavailable — overlapping confirmed booking]"
- [ ] Staff dashboard shows only the first reservation (10–12 Oct)
- **Verify:** overlapping bookings are prevented at AI level, no Postgres constraint violation in logs

### D4. Pricing Consistency
- [ ] Staff modifies pricing (add a special rate for Dec 20–25)
- [ ] AI creates a reservation for Dec 21–23
- [ ] Price should reflect the new special rate (e.g., OMR 120/night instead of 160)
- [ ] Staff dashboard shows the same price breakdown
- **Verify:** pricing changes are live to both AI and dashboard

### D5. Knowledge Base Consistency
- [ ] Staff adds a new FAQ: "Do you have parking?" / "Yes, free parking" (English) + Arabic
- [ ] AI chat asks: "Is there parking?"
- [ ] AI fetches KB and responds: "Yes, free parking"
- [ ] Staff dashboard Knowledge Base page shows the new entry
- **Verify:** KB updates are immediate to both systems

---

## Part E: Regression Tests (Automated)

Run the provided test suite:

```bash
npm run verify:phase0
npm run verify:phase1
npm run verify:phase2
npm run verify:phase3
npm run verify:phase4
npm run verify:phase5
```

- [ ] All phases pass (should show "X/X tests PASSED")
- [ ] No new errors
- [ ] Build + lint clean

---

## Part F: Security & Edge Cases

### F1. Cross-Tenant Isolation
- [ ] Log in as org owner (Queens Garden)
- [ ] Attempt to access `/admin` → redirected to `/dashboard`
- [ ] Attempt to access another org's data via URL manipulation (e.g. `/dashboard?orgId=OTHER`) → should fail or show nothing
- **Verify:** platform admin routes blocked, data scoped correctly

### F2. Same-Day Booking
- [ ] AI chat: "Can I book for today?"
- [ ] Check if property allows same-day bookings (per schema: `allowSameDayBooking`)
- [ ] If yes, AI should allow it; if no, AI should decline
- **Verify:** same-day rule is enforced

### F3. Guest Count Validation
- [ ] AI chat: "I want to book for 25 people"
- [ ] Max guests is 20 (from seed)
- [ ] AI should decline: "[Error: Guest count exceeds maximum (20 guests)]"
- **Verify:** guest count is validated server-side

### F4. Minimum Stay Validation
- [ ] Property is set to minStayNights = 1 (default)
- [ ] AI chat: "Book for just a few hours"
- [ ] AI should decline: "[Error: Minimum stay is 1 night]"
- **Verify:** minimum stay rule enforced

### F5. Invalid Dates
- [ ] AI chat: "Book for yesterday"
- [ ] AI should decline: "[Error: Check-in date cannot be in the past]"
- **Verify:** date validation works

---

## Part G: Performance & UX

### G1. Page Load Times
- [ ] Dashboard home loads in <2 seconds
- [ ] Calendar loads in <2 seconds
- [ ] AI chat loads in <1 second
- **Verify:** no obvious slowness

### G2. Language Toggle
- [ ] Switch English ↔ Arabic in the dashboard header
- [ ] All text flips correctly (RTL in Arabic, LTR in English)
- [ ] No layout breaks
- **Verify:** bilingual UI is smooth

### G3. Error Messages
- [ ] Trigger an error (e.g., invalid date in a form)
- [ ] Error message is clear and non-technical
- [ ] User knows what to do to fix it
- **Verify:** error UX is good

### G4. No Console Errors
- [ ] Open Chrome DevTools (F12)
- [ ] Go through entire flow (A–D sections)
- [ ] Console should have NO red error messages
- [ ] Warnings are OK (e.g. Next.js dev warnings)
- **Verify:** code is production-ready

---

## Checklist Summary

- [ ] Part A: Dashboard staff flow (8 checks)
- [ ] Part B: AI English booking (6 checks)
- [ ] Part C: AI Arabic booking (5 checks)
- [ ] Part D: Cross-verify consistency (5 checks)
- [ ] Part E: Regression tests (all pass)
- [ ] Part F: Security & edge cases (5 checks)
- [ ] Part G: Performance & UX (4 checks)

**Total: 38 manual checks + automated regression suite**

---

## Expected Outcome

If all checks pass:
- ✅ Dashboard is production-ready for staff (resort owner can manage bookings, pricing, KB, calendar)
- ✅ AI is production-ready for customers (booking flow, language detection, handover, KB queries)
- ✅ Data consistency across both systems (single source of truth)
- ✅ Security & isolation (multi-tenant, no cross-org leakage)
- ✅ No technical debt (lint clean, tests pass, no console errors)

**Next steps after test passes:**
- Phase 6 (Knowledge Base enrichment) — optional, quick
- Phase 7 (WhatsApp integration) — production customer channel
- Phase 8 (Instagram integration) — reuses exact same AI + backend
- Phase 9 (Real payment gateway) — only after WhatsApp is live
- Phase 10 (Production hardening) — deploy checklist

---

## Notes for Test Execution

- **Timing:** Expect 1–2 hours for a full run (automated tests take ~10–15 min, manual tests take 45–60 min)
- **Logs:** If anything fails, check `npm run logs` or browser console for details
- **Rollback:** If you find a bug, report it and I can write a Phase 5.1 patch prompt for OpenCode
- **No data loss:** Test data is in a test database; production data is untouched
