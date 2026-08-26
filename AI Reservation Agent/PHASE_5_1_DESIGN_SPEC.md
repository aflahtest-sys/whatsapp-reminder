# Phase 5.1 — Dashboard & Calendar UX Enhancements

**Scope:** Improve dashboard home and Reservations page before testing Phase 0–5.

No new backend logic. UI-only changes. All tests still pass.

---

## 1. Dashboard Home — Balanced Scorecard KPIs

Replace the current simple "next booking" card with a professional 2×2 scorecard grid at the top of the dashboard.

### Layout

```
┌─────────────────────────────────────────┐
│        QUEENS GARDEN CHALET              │
├─────────────────────────┬─────────────────┤
│ OMR 2,400 Revenue       │ 60% Occupancy    │
│ This Month              │ 18/30 nights     │
├─────────────────────────┼─────────────────┤
│ OMR 150 Pending         │ 2 Days Blocked   │
│ Awaiting Payment        │ Next 30 Days     │
└─────────────────────────┴─────────────────┘
```

### Card Design (each tile)

- Large number (primary metric) in bold, size 28–32px
- Smaller label below (secondary text, size 12–14px, gray)
- Icon in top-right corner (money, chart, calendar, lock — lucide icons)
- Subtle background color (light gray or property brand color at 10% opacity)
- Border: 1px light gray, rounded corners (8px)
- On hover: slight shadow lift, cursor pointer (clickable to drill down)

### Metric Definitions

**Top Left: Revenue This Month**
- Sum of `totalPrice` for all CONFIRMED/COMPLETED reservations with `checkIn` in the current month
- Show as "OMR X,XXX"
- Click to see revenue breakdown by week

**Top Right: Occupancy %**
- Calculate: (nights booked in next 30 days) / 30
- Show as "XX% Occupancy — N/30 nights"
- Calculate by: sum of (checkOut - checkIn) for all active reservations in next 30 days
- Click to see day-by-day breakdown

**Bottom Left: Pending Payments**
- Sum of `depositAmount` for all PAYMENT_PENDING reservations
- Show as "OMR X,XXX Awaiting Payment"
- Click to see pending reservation list

**Bottom Right: Blocked Days (next 30 days)**
- Count of `BlockedDate` entries in the next 30 days
- Show as "N Days Blocked"
- Click to see blocked dates with reasons

### Bilingual Support

- All labels bilingual (EN/AR)
- RTL layout when Arabic is selected
- Numbers always LTR (OMR 2,400 stays LTR even in Arabic UI)

### Data Queries

All queries should be:
- Org-scoped (from session)
- Efficient (indexed on `propertyId`, `checkIn`, `checkOut`, `status`, `createdAt`)
- Cached for 5 minutes (optional, for perf)

---

## 2. Reservations Page — Inline Date Picker (Hotel Datepicker Style)

### Current State
Reservations list with search/filter, detail modal for booking.

### New State
Add an inline date range picker at the top of the Reservations page, styled like Hotel Datepicker (hoteldatepicker.org).

### Layout

```
┌─ RESERVATIONS ──────────────────────────────┐
│                                             │
│ [📅 Check-in] ──────> [📅 Check-out]        │
│ [Guests: 2] [Create Booking]                │
│                                             │
├─────────────────────────────────────────────┤
│ Availability Preview (inline):              │
│ ✅ Jan 20 ✅ Jan 21 ❌ Jan 22 🔒 Jan 23 … │
│                                             │
├─────────────────────────────────────────────┤
│ Reservations List (filtered by date range): │
│                                             │
│ Ahmed | 20 Jan → 22 Jan | 2 guests | ... │
│ Sara  | 25 Jan → 27 Jan | 4 guests | ... │
│ ...                                         │
└─────────────────────────────────────────────┘
```

### Components

**A. Date Range Picker (Inline)**
- Two date inputs: [Check-in] and [Check-out]
- When user selects dates, the picker stays open (no modal)
- Show a mini calendar below the inputs for visual feedback
- Selected range is highlighted (light blue/teal)
- Blocked dates shown in red (cross-hatched or dark color)
- Booked dates shown in yellow/orange (striped or muted)
- Available dates shown in green or normal
- Guests count picker (spinner or dropdown, default 1, max 20)
- "Create Booking" button (blue, prominent)
- "Clear" button (secondary)

**B. Availability Preview Row**
- Below the date picker, show a horizontal bar: 🟢 🟢 🟡 🔴 🟢 🟢 …
- Each circle = one day in the selected range
- 🟢 = available, 🟡 = booked/pending, 🔴 = blocked
- On hover, show the date and status
- Tapping/clicking a date in the preview updates the picker

**C. Reservations List (Filtered)**
- If a date range is selected, filter the list to show only reservations that overlap with the range
- Show: Customer name | Check-in → Check-out | Guest count | Total price | Status | Actions (Edit/Cancel)
- If no range selected, show all reservations (default behavior)
- Still sortable by date, status, customer

### Behavior

1. User opens Reservations page
2. Date picker defaults to: today → tomorrow (default 1-night range)
3. Availability preview shows the next 30 days
4. Reservations list shows all reservations (or filtered to today/tomorrow if desired)
5. User clicks a date in the preview or types in the date fields
6. List updates in real-time (or on blur/Enter)
7. User selects a date range where there's a gap (available)
8. Clicks "Create Booking"
9. Modal or side panel opens for guest/notes details
10. Booking is created, list updates

### Styling

- Professional/corporate: clean lines, subtle colors
- Date picker background: white
- Input borders: light gray (1px)
- Selected date range: light blue (#E3F2FD or similar)
- Blocked dates: light red (#FFEBEE or similar)
- Booked dates: light orange (#FFF3E0 or similar)
- Available dates: white or light green (#F1F8E9 or similar)
- Text: dark gray (#333)
- Accent (Create Booking button): property brand color or blue (#2196F3)

### Bilingual Support

- Date picker labels bilingual (Check-in / تاريخ الوصول)
- RTL layout when Arabic
- Date format: auto-detect from locale (EN: "Jan 20, 2026" | AR: "20 يناير 2026")
- Guest count label bilingual

### Accessibility

- Keyboard navigation: Tab to move between fields, Arrow keys to change dates
- ARIA labels on buttons and date inputs
- Screen reader friendly: "Check-in date selected: 20 January 2026"

---

## 3. Calendar Page — Professional/Corporate Style

### Current State
Calendar grid showing AVAILABLE / BOOKED / BLOCKED states, clickable to detail or block.

### New State
Refresh the calendar with a professional, corporate look (like Outlook/Google Calendar).

### Design

- Clean grid layout (7 columns for days of week, rows for weeks)
- Day cells: tall enough to show multiple events/states
- Header: month/year selector, navigation arrows (← →), "Today" button
- Color scheme: white/light gray background, subtle borders
- Day states:
  - **AVAILABLE**: white background, no border or light border
  - **BOOKED**: solid light blue (#E3F2FD) with 1px darker blue border
  - **PAYMENT_PENDING**: solid light orange (#FFF3E0) with 1px darker orange border
  - **BLOCKED**: solid light red (#FFEBEE) with diagonal stripe pattern or darker red border
  - **COMPLETED**: light gray (#F5F5F5), faded text

### Cell Content

```
┌─────────────────────────────┐
│  20                         │
│  Thu                        │
│                             │
│ 🔵 Ahmed (2) — OMR 320     │
│                             │
│ [Edit] [Block/Unblock]      │
└─────────────────────────────┘
```

- Date (20), day of week (Thu), top-left
- Reservation summary: small avatar (initials or icon), customer name, guest count, price
- If multiple reservations: show "Scroll" hint or "+N more"
- Bottom-right: status badge (Confirmed ✓, Pending ⏳, Blocked 🔒)
- Hover effects: subtle shadow lift, highlight background

### Interactions

- Click a day to open a detail panel (sidebar or modal) showing:
  - All reservations for that day
  - Availability status
  - Option to create a booking or block the date
- Click "Block Date" → two-step confirm → reason textarea → submit
- Click reservation → open reservation detail (edit/cancel)
- Drag-and-drop to move a reservation to a different date (optional, nice-to-have)

### Bilingual Support

- Month/year in user's language (January 2026 | يناير 2026)
- Day names: Mon, Tue, … | الاثنين، الثلاثاء، …
- RTL layout when Arabic selected

### Responsive

- Desktop: full 7-column grid
- Tablet (768px): still full grid, slightly smaller cells
- Mobile: switch to "Day view" or "Week view" (not full month)

---

## Implementation Checklist

### Backend (lib/services)

- [ ] `getMonthRevenue(propertyId, month, year)` → total revenue for the month
- [ ] `getMonthOccupancy(propertyId, days=30)` → count booked nights in next N days, occupancy %
- [ ] `getPendingPayments(propertyId)` → sum of pending deposits
- [ ] `getBlockedDaysCount(propertyId, days=30)` → count blocked dates in next N days
- [ ] `getAvailabilityPreview(propertyId, startDate, endDate)` → array of day states (AVAILABLE, BOOKED, BLOCKED)

All queries org-scoped, efficient, optional caching.

### Frontend (components)

- [ ] `DashboardHome` — add Scorecard grid (4 metric cards)
- [ ] `ReservationsPage` — add InlineDatePicker component (date inputs + guest count + preview bar)
- [ ] `ReservationsPage` — update list to filter by selected date range
- [ ] `CalendarPage` — refresh with professional grid layout (day cells, hover details, interactions)
- [ ] All components: bilingual EN/AR, RTL support, accessibility (ARIA labels)

### Styles

- [ ] Scorecard metrics: Tailwind utility classes (new or extended)
- [ ] Date picker: inline, no modal, clean inputs
- [ ] Calendar grid: professional, corporate feel
- [ ] Color palette: use neutral tones (white, light gray, light blue/orange/red)
- [ ] Dark mode support (optional, nice-to-have)

---

## Testing

- [ ] All KPI metrics calculate correctly (revenue, occupancy, pending, blocked)
- [ ] Date picker updates availability preview in real-time
- [ ] Reservations list filters by selected date range
- [ ] Calendar grid renders all days correctly, states match DB
- [ ] Drag-and-drop works (if implemented)
- [ ] Bilingual: all labels EN/AR, RTL rendering correct
- [ ] Mobile responsive: calendar switches to day/week view
- [ ] Accessibility: keyboard nav, ARIA labels, screen reader friendly
- [ ] Performance: calendar month loads in <1 second
- [ ] No console errors

---

## Time Estimate

OpenCode implementation: ~2–3 hours (design + components + queries)
