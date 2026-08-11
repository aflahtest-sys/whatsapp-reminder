-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

/* ------------------------------- tables ------------------------------ */

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  account_name text,
  qr_code text,
  session_data text,
  is_authenticated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  phone text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  template_id uuid not null references public.message_templates(id) on delete cascade,
  send_type text not null check (send_type in ('immediate', 'once', 'daily', 'weekly')),
  schedule_time timestamptz,
  last_sent timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  message_body text not null,
  error text,
  sent_at timestamptz not null default now(),
  status text not null check (status in ('success', 'failed'))
);

/* ----------------------------- indexes ------------------------------ */

create index if not exists idx_sessions_user on public.whatsapp_sessions (user_id);
create index if not exists idx_customers_user on public.customers (user_id);
create index if not exists idx_templates_user on public.message_templates (user_id);
create index if not exists idx_schedules_user on public.scheduled_sends (user_id);
create index if not exists idx_schedules_status on public.scheduled_sends (status);
create index if not exists idx_schedules_due on public.scheduled_sends (schedule_time);
create index if not exists idx_logs_user on public.delivery_logs (user_id, sent_at desc);

/* -------------------- row level security policies -------------------- */
-- Defense in depth: even if the anon key (or a leaked client token) is used
-- against PostgREST directly, every user can only touch their own rows.

alter table public.users enable row level security;
alter table public.whatsapp_sessions enable row level security;
alter table public.customers enable row level security;
alter table public.message_templates enable row level security;
alter table public.scheduled_sends enable row level security;
alter table public.delivery_logs enable row level security;

create policy "users select own profile" on public.users
  for select using (auth.uid() = id);

create policy "users own whatsapp sessions" on public.whatsapp_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own customers" on public.customers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own templates" on public.message_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own schedules" on public.scheduled_sends
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own logs" on public.delivery_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
