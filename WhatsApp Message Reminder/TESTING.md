# Testing checklist

Ordered so the things that fail fastest come first. Stop at the first failure —
each stage depends on the one before it.

Times marked ⏱ mean you have to wait for the minute-by-minute scheduler.

---

## Stage 0 — before touching the UI (5 minutes)

- [ ] **Run the migration.** Supabase → SQL Editor → paste `database/schema.sql` → Run.
      It should finish with no error. Re-run it a second time; it must still succeed
      (it is written to be safe to repeat).
- [ ] **Check the tables changed.** Table Editor → `customers` has a `tags` column;
      `scheduled_sends` has `target_type`, `target_tag`, `weekly_day`, `locked_at`,
      `attempts`, `last_error`.
- [ ] **Unit tests pass.** `cd backend && npm install && npm test` → 40 passing.
      These cover the recurrence maths, phone parsing, placeholder substitution and
      the schedule-outcome rules. No database needed.
- [ ] **Backend starts.** `npm start`. You should see:
      ```
      Server listening on port 8080
      WhatsApp sessions stored in ...
      Timezone Asia/Muscat, default country code +968
      ```
      No `Missing required environment variables`, no stack trace.
- [ ] **Health check.** Open `http://localhost:8080/health` → `{"ok":true,...}`.
- [ ] **Frontend starts.** `cd frontend && npm install && npm run dev` → open
      http://localhost:5173.

---

## Stage 1 — accounts (3 minutes)

- [ ] Register with a valid email and an **8+ character** password. (The minimum
      went up from 6.)
- [ ] Register the same email again → "Email already registered".
- [ ] Register with a 5-character password → clear 400 message, no account created.
- [ ] Sign out, sign back in.
- [ ] Wrong password → "Invalid email or password" (it must not say whether the
      email exists).
- [ ] Enter a wrong password 11 times in a row → you get rate-limited with a
      "wait 15 minutes" message. **Then wait it out or restart the backend**, or
      you will be locked out of your own testing.

---

## Stage 2 — link WhatsApp (5 minutes)

- [ ] WhatsApp tab → Link account. A QR code appears within ~20 seconds.
- [ ] Scan it (phone → WhatsApp → Settings → Linked devices → Link a device).
- [ ] Status turns green: "Connected. Reminders will be sent from this account."
- [ ] **Send a test message to your own number.** This is the single most useful
      check in the whole list — if it arrives, the hard part works.
- [ ] Try the test box with a number that has no WhatsApp account →
      "This number is not registered on WhatsApp", not a crash.

### The one that used to be broken

- [ ] **Restart the backend** (Ctrl+C, `npm start`). Within about 30 seconds the
      status should return to Connected **without a new QR code**, and the log
      should show `restoring 1 linked account(s)`.
      *This is the fix for the old bug where every restart forced a rescan.*
- [ ] Turn your phone's wifi and data off for a minute, then back on. The log
      shows a disconnect and then `reconnecting user ... in 30s`, and the status
      recovers on its own.

---

## Stage 3 — customers, groups and templates (5 minutes)

- [ ] Add a customer with `+968 9123 4567` (spaces and plus sign) → stored and
      displayed as `+968 91234567`.
- [ ] Add another customer with the **same number** in a different format
      (`96891234567`) → rejected: "A customer with that phone number already
      exists". *This stops one client getting every reminder twice.*
- [ ] Add a customer typing only `91234567` with no country code → accepted, and
      the toast tells you `+968` was assumed.
- [ ] Add a customer with `12` → rejected as too short.
- [ ] Tag three customers with the same group name, e.g. `service-due`.
- [ ] With more than 5 customers, the search box appears; type a **name** → the
      list actually narrows. *(It used to match everything.)*
- [ ] Delete a customer → a confirmation dialog appears first and warns that
      scheduled reminders go too.
- [ ] Create a template containing `Hi {name}, your drone is due on {date}.`
      The preview shows real sample values, not braces.
- [ ] Type `{custmer}` into a template → an inline error names the bad
      placeholder and the save button is disabled.

---

## Stage 4 — sending (15 minutes, mostly waiting)

- [ ] **Send now, one customer.** Message arrives within seconds. Delivery log
      shows `delivered`. In Supabase, the schedule row is `completed`.
- [ ] **Confirm the received message says your name**, not `{name}`.
      *This was broken before — every client received the literal placeholder.*
- [ ] **The schedule stays `completed`.** Wait 2 minutes and refresh. It must not
      go back to `active`. *Previously a "send now" silently became a weekly
      message that repeated forever.*
- [ ] **Send now, to a group.** Pick the `service-due` group. A dialog warns
      "Send to 3 people now?". Confirm. The three messages arrive **spaced
      5–14 seconds apart**, not all at once. This spacing is deliberate.
- [ ] **Cancel mid-send.** Make a group of 5+, start a "Send now", and press
      Cancel on the row while messages are still going out. The remaining people
      get nothing, and the row stays `cancelled` — it must not flip back to
      active. ⏱
- [ ] **One-time send** 2 minutes out. Before: `active`. After: message arrives,
      row goes `completed`. ⏱
- [ ] **Cancel a pending one-time send** before its time → `cancelled`, nothing
      sent. ⏱

### Recurring

- [ ] **Daily** send with the time set 2 minutes from now. After it fires,
      "Next run" is exactly **tomorrow** at the same time. ⏱
- [ ] **Weekly** send: pick a weekday and time 2 minutes out. It fires, and
      "Next run" is **7 days later on the same weekday**. Check the Repeats column
      says the same day you picked. ⏱
- [ ] **Failure does not kill a recurring schedule.** Create a daily send, then
      disconnect WhatsApp before it fires. The row stays `active` with a
      `last_error` note — it must not become `failed`. Reconnect and it resumes. ⏱
      *Previously one failure ended a daily reminder permanently.*

### The burst test — worth the effort

- [ ] Create a daily send. In Supabase, edit that row's `schedule_time` to
      **three days ago** (same time of day) and leave `status` as `active`.
      Within a minute the scheduler picks it up: **exactly one message** goes
      out, and `schedule_time` jumps to the next future slot.
      *The old code advanced by one day at a time, so it fired three messages
      about a minute apart.*

---

## Stage 5 — isolation between accounts (5 minutes)

Use two browsers, or one normal and one private window.

- [ ] Register a second account. Its Customers, Templates, Reminders and
      Delivery log are all **empty**.
- [ ] Account 2 must never see account 1's data anywhere.
- [ ] Copy a customer id from account 1 (Supabase Table Editor). In account 2's
      browser console:
      ```js
      fetch('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({
          customer_id: '<account 1 customer id>',
          template_id: '<account 2 template id>',
          send_type: 'immediate',
          target_type: 'customer'
        })
      }).then(r => r.json()).then(console.log)
      ```
      → must return `{"error":"Customer not found"}`.
      *This one mattered: before the fix, account 2 could schedule messages to
      account 1's clients.*

---

## Stage 6 — deployment

- [ ] **Railway → Settings → Root Directory = `WhatsApp Message Reminder`.**
      The Dockerfile moved with the project; the old setting points at a path
      that no longer exists.
- [ ] **Railway → Volumes → mount at `/data`.** Without it, every redeploy wipes
      the WhatsApp login.
- [ ] Variables set: `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET` (32+ chars),
      `CLIENT_ORIGIN`, `NODE_ENV=production`.
- [ ] **Vercel → Root Directory = `WhatsApp Message Reminder/frontend`**, and
      `VITE_API_URL` set to the Railway URL. Redeploy after changing it — Vite
      bakes this value in at build time.
- [ ] `https://<railway-domain>/health` returns `{"ok":true}`.
- [ ] Open the Vercel site, sign in, and check the browser Network tab: API calls
      go to the Railway domain, not to `/api`.
- [ ] Link WhatsApp on the deployed version, then **redeploy** and confirm it
      stays connected. This proves the volume is working.
- [ ] `git log --all --full-history -- "**/.env"` prints nothing.

---

## Notes on what changed since the last checklist

Items from the old `TESTING.md` that are no longer correct:

| Old expectation | Now |
|---|---|
| Password ≥ 6 characters | ≥ 8 |
| Session survives restart via `session_data` column | Survives via files on disk (`WA_SESSION_PATH`); that column is unused |
| Send while disconnected → immediately `failed` | Retries for up to 24 hours, then `failed` |
| Any failure → schedule `failed` | Recurring schedules stay `active` and move to the next slot |
| RLS is a second line of defence per user | RLS blocks the public key entirely; per-account isolation is enforced in `server.js` |
| One schedule = one customer | Can target one customer, a group tag, or everyone |
