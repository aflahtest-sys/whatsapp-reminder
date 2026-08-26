# WhatsApp Reminders

Send scheduled WhatsApp reminders to your clients. React + Vite frontend, Express
backend, Supabase (Postgres) for storage, `whatsapp-web.js` for delivery.

```
frontend/   React app (Vite)
backend/    Express API + scheduler
database/   schema.sql - run this in Supabase
```

---

## Do these three things before anything else

**1. Run the migration.** Open Supabase → SQL Editor → New query, paste
`database/schema.sql`, run it. It is safe on an existing database: it adds the new
columns, backfills, and repairs rows the old scheduler left broken (see
*One-off data corrections* at the bottom of the file).

**2. Give the backend a persistent volume.** WhatsApp logins are now stored on
disk. Without a volume, every Railway redeploy wipes the login and you have to
scan the QR code again.

- Railway → your service → **Volumes** → mount one at `/data`
- Add the variable `WA_SESSION_PATH=/data/wwebjs_auth`

**3. Check whether `.env` was ever committed.** It holds the Supabase *service
role* key, which bypasses every security rule in the database.

```bash
git log --all --full-history -- backend/.env
```

If that prints anything, the key is in your git history. Rotate it in Supabase →
Settings → API, and update the variable wherever the backend runs. A
`backend/.gitignore` is now in place so it will not happen again.

---

## Environment variables

Backend — see `backend/.env.example` for the full list.

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL |
| `SUPABASE_KEY` | yes | **Service role** key. Server only, never the browser. |
| `JWT_SECRET` | yes | 32+ characters. `openssl rand -hex 32` |
| `CLIENT_ORIGIN` | strongly recommended | Your frontend URL. Unset means any site can call the API. |
| `WA_SESSION_PATH` | on Railway | Point at the mounted volume, e.g. `/data/wwebjs_auth` |
| `DEFAULT_COUNTRY_CODE` | no | Defaults to `968` (Oman) |
| `APP_TIMEZONE` | no | Defaults to `Asia/Muscat`. Used for `{date}` / `{time}` / `{day}` |

Frontend — `VITE_API_URL` must be set **where you build**, not where you run.
Vite bakes it into the bundle. On Vercel: Project Settings → Environment
Variables. Leave it unset locally; `npm run dev` proxies `/api` to
`localhost:8080`.

---

## Running it

```bash
# backend
cd backend && npm install && npm start

# frontend, in another terminal
cd frontend && npm install && npm run dev
```

Then: sign in → **WhatsApp** tab → Link account → scan the QR with your phone
(WhatsApp → Settings → Linked devices) → **send yourself a test message** before
scheduling anything for real clients.

```bash
cd backend && npm test    # 40 unit tests, no database needed
```

---

## How the scheduler works

A timer ticks every minute and picks up schedules whose `schedule_time` has
passed.

- Each schedule is **claimed** with an atomic row update before it runs, so two
  ticks (or two server instances) can never send the same reminder twice.
- Messages are spaced **5–14 seconds apart, randomly**. Sending in a tight burst
  is the clearest signal WhatsApp uses to identify a spammer. A 50-person group
  therefore takes 5–10 minutes to go out. This is deliberate.
- Different accounts run **in parallel**, so one big group send does not hold up
  anybody else's reminders.
- **Missed runs are skipped, not replayed.** If the server is down for three
  days, a daily reminder sends once when it comes back — not three times.
- A failed send **does not kill a recurring schedule**; it moves on to the next
  slot. A one-off send retries for up to 24 hours, then gives up.
- Pressing **Cancel** stops a bulk send that is already in progress.

### Message templates

Use `{name}`, `{phone}`, `{date}`, `{time}`, `{day}`. Anything else is rejected
when you save the template, so a client can never receive a literal `{name}`.

---

## Things worth knowing

**This is not an official WhatsApp channel.** `whatsapp-web.js` drives WhatsApp
Web through a headless browser. It works, but it is against WhatsApp's Terms of
Service, and numbers that send unwanted bulk messages get banned. Message only
clients who expect to hear from you, keep volumes sane, and always offer a way to
opt out. If this becomes important to the business, the official
**WhatsApp Business Cloud API** is the ban-proof path — it costs per conversation
and message templates need Meta's approval, but nobody can take your number away.

**One WhatsApp account per user, one server instance.** Live connections are held
in the server's memory. Running two replicas would mean two browsers fighting over
the same login. The database work is already safe for multiple instances; the
WhatsApp side is not.

**Daylight saving.** Recurring schedules advance by a fixed 24 hours or 7 days.
Oman has no DST, so times stay exact. If you ever serve clients in a country that
changes its clocks, recurrence needs reworking against a stored wall-clock time
plus timezone.

**Phone numbers** are stored as digits with a country code and no `+`. A number
typed without a country code gets `DEFAULT_COUNTRY_CODE` and the UI tells you it
did. One number per account — duplicates are rejected so nobody gets every
reminder twice.

---

## Layout

```
backend/
  server.js            Express app, routes, boot
  lib/config.js        environment, validated at startup
  lib/db.js            Supabase client
  lib/whatsapp.js      connections, QR, reconnect, sending
  lib/scheduler.js     the minute tick, claiming, pacing
  lib/outcome.js       what happens to a schedule after a run  (pure, tested)
  lib/recurrence.js    next-run maths                          (pure, tested)
  lib/phone.js         number parsing and validation           (pure, tested)
  lib/template.js      placeholder substitution                (pure, tested)
  lib/ratelimit.js     in-memory rate limiter
  test/                40 unit tests

frontend/src/
  App.jsx              shell and navigation
  api.js               fetch wrapper, auth token
  components/          one file per tab, plus shared UI
  lib/                 date and phone helpers
```
