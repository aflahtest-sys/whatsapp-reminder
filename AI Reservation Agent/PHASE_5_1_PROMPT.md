# Phase 5.1 kickoff prompt — paste this into OpenCode

Use this as your next message to OpenCode. It's a small enhancement phase (no new business logic, UI/UX only) that improves the dashboard and Reservations page before testing.

---

```
This is Phase 5.1 — Dashboard & Calendar UX Enhancements.

Phase 5 (AI Agent) is complete. Before we run the full system test, improve the dashboard home and
Reservations page per the design spec: PHASE_5_1_DESIGN_SPEC.md

Read that file fully before you start. It has exact layouts, color schemes, queries, and component specs.

This phase is UI-only — no backend logic changes, no new tables, no AI changes. All Phase 0–5 tests
must still pass after your changes.

Build:

1. Dashboard Home — Balanced Scorecard KPIs (replace or supplement the current simple cards)
   - Add 2×2 metric grid at the top:
     * Top-left: Revenue This Month (sum of totalPrice, CONFIRMED+COMPLETED, this calendar month)
     * Top-right: Occupancy % (nights booked in next 30 days / 30, show "60% Occupancy — 18/30 nights")
     * Bottom-left: Pending Payments (sum of depositAmount, PAYMENT_PENDING reservations)
     * Bottom-right: Blocked Days Next 30 (count of BlockedDate entries)
   - Each card: large metric number (28–32px bold), label below (gray, 12–14px), lucide icon (top-right),
     light background (10% brand color or gray), 1px border, 8px rounded corners
   - On hover: subtle shadow lift
   - Bilingual EN/AR, RTL support
   - Org-scoped queries, efficient (use indexes on propertyId, checkIn, checkOut, status)

2. Reservations Page — Inline Date Picker (Hotel Datepicker style, no modal)
   - Add inline date range picker at the top:
     * Two inputs: [Check-in date] [Check-out date]
     * Guest count picker (spinner or dropdown, 1–20, default 2)
     * "Create Booking" button (blue, prominent)
     * "Clear" button (secondary)
   - Below the inputs, show a 30-day availability preview bar:
     * Horizontal row of circles: 🟢 (available) 🟡 (booked/pending) 🔴 (blocked)
     * One circle per day in the next 30 days
     * Hoverable/clickable (show date + status on hover)
   - Reservations list below:
     * If a date range is selected in the picker, filter the list to show only overlapping reservations
     * If no range selected, show all reservations
     * Columns: Customer | Check-in → Check-out | Guests | Total | Status | Actions (Edit/Cancel)
     * Still sortable
   - Bilingual EN/AR, date format auto-detect (EN: "Jan 20, 2026" | AR: "20 يناير 2026")
   - Accessibility: keyboard nav (Tab, Arrow keys), ARIA labels

3. Calendar Page — Professional/Corporate Refresh
   - Keep the current grid layout, enhance styling:
     * White/light gray background, subtle 1px borders on cells
     * Day cells: tall enough for multiple events
     * Color states:
       - AVAILABLE: white, light border
       - BOOKED: light blue (#E3F2FD) with 1px blue border
       - PAYMENT_PENDING: light orange (#FFF3E0) with 1px orange border
       - BLOCKED: light red (#FFEBEE) with diagonal stripes or darker border
       - COMPLETED: light gray (#F5F5F5), faded text
     * Each cell shows: date, day-of-week (top-left), reservations (avatar + name + guests + price),
       status badge (bottom-right)
     * On hover: subtle shadow lift, highlight background
   - Header: month/year selector, navigation arrows (← →), "Today" button
   - Click a day → detail panel (sidebar or modal) showing all events for that day, option to create/block
   - Bilingual month/year/day names, RTL layout
   - Responsive: desktop full grid, tablet full grid (smaller), mobile day/week view (optional)

All new queries (getMonthRevenue, getMonthOccupancy, etc.) go in lib/services (see spec for list).
Keep business logic in backend, UI components in components/. Server actions for data fetching.

Definition of done:
- Dashboard home shows the 2×2 scorecard, metrics are correct (test with known data)
- Reservations page has inline date picker, availability preview bar, filtered list works
- Calendar page is visually professional, corporate, clean
- All Phase 0–5 tests still pass (`npm run verify:phase0` through `npm run verify:phase5`)
- Bilingual: all text EN/AR, RTL rendering correct
- Accessibility: keyboard navigation works, ARIA labels present
- Build + lint clean, no console errors
- When done, show me the verification steps (URLs, what to see, checklist)

This is a quick polish pass before the full system test. No new backend business logic — just better UX.
```
