# Testing checklist (5-user scenario)

Run this with 5 test accounts. Use different WhatsApp numbers and phone numbers that are not in each other's contact lists.

## 1. Auth
- [ ] User 1 registers with a valid email + password (>= 6 chars).
- [ ] Registering with the same email again returns an error ("Email already registered").
- [ ] Registering with an invalid email or short password returns a clear 400.
- [ ] User 1 logs out, logs back in with the same credentials - works.
- [ ] Login with a wrong password returns 401 "Invalid email or password".
- [ ] Calling `/auth/me` without a token returns 401.

## 2. User isolation
- [ ] User 1 adds a customer and a template.
- [ ] User 2 logs in and sees **empty** Customers/Templates/Schedules/Logs.
- [ ] User 2 calls `GET /customers` with User 1's token (token swap test): returns 401 for the wrong token or only User 2's rows - never User 1's data.
- [ ] User 2 tries `PUT /customers/<user1_customer_id>` - returns 404 (not found), cannot modify User 1's data.
- [ ] User 2 tries `DELETE /customers/<user1_customer_id>` - has no effect on User 1's data.
- [ ] In Supabase dashboard, confirm each table's RLS policies are enabled (they are a second line of defense; the backend service role bypasses them by design).

## 3. WhatsApp linking
- [ ] User 1 clicks "Link WhatsApp account" - a QR code image appears within a few seconds.
- [ ] User 1 scans it with their phone (WhatsApp > Linked devices > Link a device).
- [ ] Status flips to "Connected" (the UI polls every 4s).
- [ ] Backend restarts (redeploy): user is still "Connected" - session resumed from `session_data` without re-scanning.
- [ ] Disconnect clears the session; the account must be re-linked next time.

## 4. Immediate send
- [ ] Create a customer + template, schedule an "immediate" send while WhatsApp is connected.
- [ ] The customer receives the WhatsApp message within seconds.
- [ ] Status Log shows `success`.
- [ ] Repeat while WhatsApp is disconnected: Status Log shows `failed` with "WhatsApp not connected", and the schedule is marked `failed`.

## 5. One-time send
- [ ] Schedule a one-time send 1-2 minutes in the future.
- [ ] Before the time: schedule shows `active`.
- [ ] After the time: message arrives, log shows `success`, schedule becomes `completed`.
- [ ] Cancel a pending one-time send - status becomes `cancelled` and no message is sent.

## 6. Daily / weekly send
- [ ] Schedule a daily send for 1 minute from now.
- [ ] After the first fire, "Next run" advances by exactly 1 day and the message was delivered.
- [ ] Schedule a weekly send for 1 minute from now - "Next run" advances by 7 days after the first send.

## 7. CRUD
- [ ] Customers: add, edit, delete - each reflected in the list and in Supabase.
- [ ] Templates: add, edit, delete.
- [ ] Deleting a customer removes its scheduled sends (cascade) but keeps past delivery logs.

## 8. Errors & edge cases
- [ ] Unknown API route returns 404 JSON with a message.
- [ ] Malformed JSON body returns a 400/500 JSON error, not an HTML crash page.
- [ ] Very long template body still sends correctly.
- [ ] Phone number with dashes/spaces/`+` normalizes and delivers.

## 9. Deployment
- [ ] Backend `/health` returns `{"ok":true}` on Railway.
- [ ] Frontend loads on the Vercel domain and talks to Railway (check the Network tab - all API calls go to `VITE_API_URL`).
- [ ] No hardcoded secrets anywhere in the repo (grep for `SUPABASE_KEY`, `JWT_SECRET`, real URLs).
- [ ] Two users can be logged in simultaneously in different browsers without any data leaking between them.
