# Setup guide

Three parts: a Supabase database, an Express backend on Railway, a React
frontend on Vercel.

```
frontend (Vercel)  -->  backend (Railway)  -->  Supabase Postgres
                        whatsapp-web.js
                        + minute scheduler
```

Everything lives under `WhatsApp Message Reminder/`:

```
WhatsApp Message Reminder/
  Dockerfile        builds the backend  (Railway build context = this folder)
  .dockerignore
  SETUP.md
  TESTING.md
  backend/
  frontend/
  database/schema.sql
```

---

## 1. Supabase

1. Create a project at https://supabase.com (free tier is fine).
2. **SQL Editor → New query** → paste `database/schema.sql` → Run.
   Safe to re-run; it also repairs rows left broken by earlier versions.
3. **Project Settings → API**, copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** → `SUPABASE_KEY`

> Use the **service role** key, not the anon key. The scheduler sends on behalf
> of every account, so it needs to read every row.
>
> This key bypasses row-level security completely. Per-account isolation is
> enforced in `server.js` — every query filters on the `user_id` taken from the
> JWT. The RLS policies in `schema.sql` are a lock on the front door (they deny
> the public key outright), *not* the thing separating one account from another.
> Never let this key reach a browser.

---

## 2. Backend on Railway

The `Dockerfile` sits in the **project folder**, not the repository root.

1. **Settings → Root Directory → `WhatsApp Message Reminder`**
   Railway then finds the Dockerfile and `COPY backend/` resolves correctly.
   Skip this and the build fails with `backend: not found`.
2. **Volumes → mount a volume at `/data`.**
   The linked WhatsApp account is stored on disk. Without a volume it lives only
   inside the container and every redeploy destroys it — you would rescan the QR
   code each time. The Dockerfile already sets `WA_SESSION_PATH=/data/wwebjs_auth`.
3. **Variables:**

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_KEY` | service role key |
   | `JWT_SECRET` | 32+ chars — `openssl rand -hex 32`. The server refuses to start in production with anything shorter. |
   | `CLIENT_ORIGIN` | your Vercel URL. Leave unset and **any website can call your API**. |
   | `NODE_ENV` | `production` |
   | `DEFAULT_COUNTRY_CODE` | optional, defaults to `968` (Oman) |
   | `APP_TIMEZONE` | optional, defaults to `Asia/Muscat` |

4. Check the generated domain: `/health` → `{"ok":true,...}`.

---

## 3. Frontend on Vercel

1. Import the repo, **Root Directory → `WhatsApp Message Reminder/frontend`**.
2. Environment variable `VITE_API_URL` = your Railway URL, no trailing slash.

> Vite bakes `VITE_API_URL` into the bundle **at build time**. Changing it means
> redeploying. If it is missing, the app calls `/api` on its own domain and every
> request 404s.

3. Deploy. Vercel detects Vite automatically.

Locally you do not need it: `npm run dev` proxies `/api` to `localhost:8080`.

---

## 4. Local development

```bash
cd backend
npm install
copy .env.example .env      # then fill in the three required values
npm test                    # 40 unit tests, no database needed
npm start                   # http://localhost:8080
```

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

First run: sign in → **WhatsApp** tab → Link account → scan the QR → **send
yourself a test message** before scheduling anything for real clients.

---

## 5. How it works

**Auth.** `/auth/register` and `/auth/login` store bcrypt hashes (cost 12) and
return a JWT valid for 7 days. The frontend keeps it in `localStorage` and sends
`Authorization: Bearer <token>`. Login is rate-limited per email *and* per IP.

**WhatsApp linking.** `POST /whatsapp/link` starts a headless browser session for
the user. The QR code is stored as an image in `whatsapp_sessions.qr_code`; the
UI polls `/whatsapp/status` every 4 seconds until it appears, then every 30 once
connected. Credentials are written to `WA_SESSION_PATH` by whatsapp-web.js's
`LocalAuth`, so a restart reconnects without a rescan. The `session_data` column
is legacy and unused. If the phone drops off the network the server retries on a
backoff (30s, 1m, 2m, … up to 15m) rather than giving up.

**Sending.** A timer runs every minute and picks up `active` schedules whose
`schedule_time` has passed. Each one is claimed with an atomic row update, so no
reminder can be sent twice even if two ticks overlap. Recipients resolve at send
time from `target_type` — one customer, a group tag, or everyone. Messages go out
**5–14 seconds apart with jitter**; bursts are what get WhatsApp numbers banned.
Different accounts send in parallel, so one large group does not block others.

**Missed runs are skipped, not replayed.** Three days of downtime means one
message when the server returns, not three.

**Failures.** A recurring schedule that fails stays `active` and moves to its
next slot. A one-off retries for 24 hours, then gives up. Pressing Cancel stops a
bulk send that is already in progress.

**Templates.** `{name}`, `{phone}`, `{date}`, `{time}`, `{day}`. Anything else is
rejected when the template is saved, so a client can never receive a literal
`{name}`.

---

## 6. Things to know

**Not an official channel.** whatsapp-web.js automates WhatsApp Web. It works,
but it breaks WhatsApp's Terms of Service and numbers sending unwanted bulk
messages get banned. Message only clients expecting to hear from you and always
offer a way to opt out. The official **WhatsApp Business Cloud API** is the
ban-proof route if this becomes business-critical.

**One instance only.** Live WhatsApp connections are held in the server's memory.
Two Railway replicas would mean two browsers fighting over one login. The
database side is already safe for multiple instances; the WhatsApp side is not.

**Phone numbers** are stored as digits with a country code and no `+`. Numbers
typed without one get `DEFAULT_COUNTRY_CODE`, and the UI says so. One number per
account — duplicates are rejected.

**Daylight saving.** Recurring sends advance by a fixed 24 hours or 7 days.
Oman has no DST so times stay exact; a country that changes its clocks would need
this reworked.
