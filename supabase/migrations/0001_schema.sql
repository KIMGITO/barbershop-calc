-- 0001_schema.sql
-- Tables, constraints, indexes and row-level security only.
-- No seed/demo data is inserted anywhere in this migration set.

create extension if not exists "pgcrypto";

create table shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table service_providers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  phone text not null,
  photo_url text,
  role_title text not null default 'Service Provider',
  active boolean not null default true,
  claimed boolean not null default false,
  device_token text,              -- set once, on claim; cleared on reset
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, phone)
);

create table services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  default_price numeric(10,2) check (default_price is null or default_price > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table earnings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,   -- auto-set by trigger, see 0003
  provider_id uuid not null references service_providers(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  note text,
  local_id text not null unique,   -- client-generated id; makes sync upserts idempotent
  created_at timestamptz not null default now()
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,   -- auto-set by trigger, see 0003
  provider_id uuid not null references service_providers(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  method text not null check (method in ('cash', 'mpesa', 'bank')),
  mpesa_code text check (method <> 'mpesa' or (mpesa_code is not null and length(mpesa_code) > 0)),
  note text,
  local_id text not null unique,
  created_at timestamptz not null default now()
);

-- === Indexes for the queries the app actually runs ===
create index idx_providers_shop on service_providers(shop_id);
create index idx_providers_phone_shop on service_providers(shop_id, phone);
create index idx_earnings_provider_created on earnings(provider_id, created_at desc);
create index idx_earnings_shop_created on earnings(shop_id, created_at desc);
create index idx_payouts_provider_created on payouts(provider_id, created_at desc);
create index idx_payouts_shop_created on payouts(shop_id, created_at desc);

-- === RLS ===
alter table shops enable row level security;
alter table service_providers enable row level security;
alter table services enable row level security;
alter table earnings enable row level security;
alter table payouts enable row level security;

-- Owner: full access, scoped to shops they own. Service providers never
-- get a Supabase Auth session at all (see 0002's claim/get_provider_view
-- functions, which run as SECURITY DEFINER and bypass RLS deliberately,
-- so there are intentionally no provider-facing RLS policies below).
create policy "owner full access - shops" on shops
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "owner full access - providers" on service_providers
  for all using (shop_id in (select id from shops where owner_user_id = auth.uid()))
  with check (shop_id in (select id from shops where owner_user_id = auth.uid()));

create policy "owner full access - services" on services
  for all using (shop_id in (select id from shops where owner_user_id = auth.uid()))
  with check (shop_id in (select id from shops where owner_user_id = auth.uid()));

create policy "owner full access - earnings" on earnings
  for all using (shop_id in (select id from shops where owner_user_id = auth.uid()))
  with check (shop_id in (select id from shops where owner_user_id = auth.uid()));

create policy "owner full access - payouts" on payouts
  for all using (shop_id in (select id from shops where owner_user_id = auth.uid()))
  with check (shop_id in (select id from shops where owner_user_id = auth.uid()));
