# Setup guide

The app has three parts: a Supabase database, an Express backend (Railway), and a React frontend (Vercel).

```
frontend (Vercel)  -->  backend (Railway)  -->  Supabase Postgres
                          (whatsapp-web.js + cron)
```

## 1. Create the Supabase project

1. Go to https://supabase.com and create a new project (free tier is fine for testing).
2. In the project dashboard open **SQL Editor**, paste the contents of `database/schema.sql`, and click **Run**. This creates all tables, indexes, and row-level-security policies.
3. Open **Project Settings > API**. Copy:
   - **Project URL** -> `SUPABASE_URL` (e.g. `https://xyzcompany.supabase.co`)
   - **service_role key** -> `SUPABASE_KEY`
     > Use the **service role** key, not the anon key. The backend runs the cron job that sends messages across all users, so it must be able to read every tenant's rows. Per-user isolation is enforced in the backend code (`user_id` is taken from the JWT and added to every query) and by RLS as a second layer.

## 2. Deploy the backend (Railway)

1. Push this project to a GitHub repo (the `backend/` folder is the deploy root).
2. On railway.app, create a new project and deploy from that repo.
3. Set the root directory to `backend`.
4. Add these environment variables (Railway > project > Variables):
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `JWT_SECRET` - any long random string, e.g. run `openssl rand -hex 32`
   - `CLIENT_ORIGIN` - the Vercel app URL once deployed (defaults to `*` otherwise)
   - `NODE_ENV=production`
5. Railway auto-detects the `Procfile` / `railway.toml` and starts `node server.js`.
6. WhatsApp requires a headless Chrome. whatsapp-web.js bundles Puppeteer, which downloads Chromium during `npm install`. If the build fails on Chromium, add a `railway.toml` deployment variable `NIXPACKS_BUILD_CMD` or switch the deploy to a Dockerfile. For most free plans the default works.
7. Open the generated domain and check `/health` returns `{"ok":true}`.

## 3. Deploy the frontend (Vercel)

1. On vercel.com, import the same repo with root directory set to `frontend`.
2. Add environment variable `VITE_API_URL` = your Railway backend URL, e.g. `https://yourapp.up.railway.app`.
   > In local development this defaults to `/api` and is proxied to `localhost:8080` (see `vite.config.js`).
3. Deploy. Vercel detects Vite automatically (`npm run build`).

## 4. Environment variables summary

| Variable          | Where        | Used for                                              |
| ----------------- | ------------ | ----------------------------------------------------- |
| `SUPABASE_URL`    | Railway, local `.env` | Database connection                              |
| `SUPABASE_KEY`    | Railway, local `.env` | Service role key for database access              |
| `JWT_SECRET`      | Railway, local `.env` | Signs/verifies auth tokens                       |
| `CLIENT_ORIGIN`   | Railway (optional)    | CORS allow-list for the frontend                |
| `VITE_API_URL`    | Vercel        | Backend base URL the browser calls                   |

## 5. Local development

Backend:
```bash
cd backend
npm install
copy .env.example .env   # fill in SUPABASE_URL, SUPABASE_KEY, JWT_SECRET
npm run dev              # http://localhost:8080
```

Frontend (separate terminal):
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173  (proxies /api to :8080)
```

## 6. How the pieces work

- **Auth**: `/auth/register` and `/auth/login` store bcrypt password hashes in the `users` table and return a JWT signed with `JWT_SECRET`. The frontend stores the token in `localStorage` and sends it as `Authorization: Bearer <token>`. Every protected route verifies the token and reads `user_id` from it.
- **WhatsApp linking**: `POST /whatsapp/link` creates a whatsapp-web.js client for the user. The QR code is rendered as an image and saved to `whatsapp_sessions.qr_code`; the frontend polls `/whatsapp/status` every 4s until it shows. Once scanned, the session is saved to `whatsapp_sessions.session_data` so it survives restarts.
- **Scheduled sends**: a `node-schedule` job runs every minute, picks up rows where `status='active'` and `schedule_time <= now`, sends the template via the user's WhatsApp client, writes a `delivery_logs` row, then updates the schedule (one-time -> `completed`, daily/weekly -> next occurrence).
- **Tenant isolation**: each user's token only maps to their own `user_id`. All data queries filter by `user_id`, and RLS policies reject cross-tenant access at the database level too.

## 7. WhatsApp notes

- Phone numbers must include the country code, e.g. `+15551234567`. Symbols and spaces are stripped automatically.
- The QR code refreshes every ~20 seconds. If it expires, scan the new one.
- Only one linked account per user in this test build.
- If a send fails with `WhatsApp not connected`, log in, go to **WhatsApp**, and make sure the session shows *Connected*.
