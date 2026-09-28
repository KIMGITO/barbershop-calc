-- 0007_provider_self_recording.sql
-- Providers can submit their own service records. Nothing reaches the real
-- earnings table until the admin approves it (optionally after editing).
-- Admin controls, per provider, whether self-recording is allowed.

alter table service_providers
  add column if not exists can_self_record boolean not null default false;

-- Audit fields on earnings created from an approved request.
alter table earnings
  add column if not exists source text not null default 'admin'
    check (source in ('admin', 'provider_request')),
  add column if not exists request_id uuid,
  add column if not exists submission jsonb;   -- what the provider originally submitted

create table if not exists earning_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  provider_id uuid not null references service_providers(id) on delete cascade,
  services jsonb not null default '[]'::jsonb,   -- snapshot built server-side from the catalog
  amount numeric(10,2) not null check (amount > 0),
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  review_note text,
  reviewed_at timestamptz,
  earning_id uuid references earnings(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists earning_requests_shop_status on earning_requests (shop_id, status, created_at desc);
create index if not exists earning_requests_provider on earning_requests (provider_id, created_at desc);

alter table earning_requests enable row level security;

-- Admin can read requests directly. All changes go through the functions
-- below, so a request can't be flipped to "approved" without creating the
-- earning. Providers have no table access at all (token-checked RPCs only).
create policy "owner read - earning requests" on earning_requests
  for select using (shop_id in (select id from shops where owner_user_id = auth.uid()));

-- Builds the services snapshot from the catalog, so a provider can't
-- invent service names or prices.
create or replace function build_services_snapshot(p_shop_id uuid, p_ids uuid[])
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'price', coalesce(s.default_price, 0)) order by s.name),
    '[]'::jsonb)
  from services s
  where s.shop_id = p_shop_id and s.id = any(coalesce(p_ids, '{}'::uuid[]));
$$;
revoke all on function build_services_snapshot(uuid, uuid[]) from public;

-- Provider: submit a record for approval.
create or replace function submit_earning_request(p_token text, p_service_ids uuid[], p_amount numeric, p_note text)
returns earning_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  prov service_providers;
  rec earning_requests;
begin
  select * into prov from service_providers
    where device_token = p_token and claimed = true and active = true;
  if not found then
    raise exception 'Invalid or reset device token';
  end if;
  if not prov.can_self_record then
    raise exception 'Recording is turned off for your account';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a valid amount';
  end if;
  if (select count(*) from earning_requests where provider_id = prov.id and status = 'pending') >= 20 then
    raise exception 'Too many records are waiting for approval';
  end if;

  insert into earning_requests (shop_id, provider_id, services, amount, note)
  values (prov.shop_id, prov.id, build_services_snapshot(prov.shop_id, p_service_ids), p_amount, nullif(trim(p_note), ''))
  returning * into rec;

  return rec;
end;
$$;
revoke all on function submit_earning_request(text, uuid[], numeric, text) from public;
grant execute on function submit_earning_request(text, uuid[], numeric, text) to anon, authenticated;

-- Provider: withdraw a request that hasn't been reviewed yet.
create or replace function cancel_earning_request(p_token text, p_request_id uuid)
returns earning_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  prov service_providers;
  rec earning_requests;
begin
  select * into prov from service_providers
    where device_token = p_token and claimed = true and active = true;
  if not found then
    raise exception 'Invalid or reset device token';
  end if;

  update earning_requests set status = 'cancelled', reviewed_at = now()
    where id = p_request_id and provider_id = prov.id and status = 'pending'
    returning * into rec;
  if not found then
    raise exception 'This request can no longer be cancelled';
  end if;
  return rec;
end;
$$;
revoke all on function cancel_earning_request(text, uuid) from public;
grant execute on function cancel_earning_request(text, uuid) to anon, authenticated;

-- Admin: approve (optionally with edits) -> creates the real earning.
-- The earning keeps the original submission for audit, and is dated when
-- the service was recorded, not when it was approved.
create or replace function approve_earning_request(
  p_request_id uuid,
  p_service_ids uuid[] default null,
  p_amount numeric default null,
  p_note text default null
)
returns earnings
language plpgsql
security definer
set search_path = public
as $$
declare
  req earning_requests;
  snap jsonb;
  final_amount numeric;
  e earnings;
begin
  select r.* into req
    from earning_requests r join shops s on s.id = r.shop_id
    where r.id = p_request_id and s.owner_user_id = auth.uid()
    for update of r;
  if not found then
    raise exception 'Request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'This request was already reviewed';
  end if;

  snap := case when p_service_ids is null then req.services
               else build_services_snapshot(req.shop_id, p_service_ids) end;
  final_amount := coalesce(p_amount, req.amount);
  if final_amount <= 0 then
    raise exception 'Enter a valid amount';
  end if;

  insert into earnings (shop_id, provider_id, service_id, services, amount, note, local_id, created_at, source, request_id, submission)
  values (
    req.shop_id, req.provider_id,
    case when jsonb_array_length(snap) = 1 then (snap->0->>'id')::uuid end,
    snap, final_amount, coalesce(p_note, req.note),
    'req-' || req.id, req.created_at, 'provider_request', req.id,
    jsonb_build_object('amount', req.amount, 'services', req.services, 'note', req.note, 'submitted_at', req.created_at)
  )
  returning * into e;

  update earning_requests
    set status = 'approved', reviewed_at = now(), earning_id = e.id
    where id = req.id;

  return e;
end;
$$;
revoke all on function approve_earning_request(uuid, uuid[], numeric, text) from public;
grant execute on function approve_earning_request(uuid, uuid[], numeric, text) to authenticated;

-- Admin: reject, with an optional reason the provider will see.
create or replace function reject_earning_request(p_request_id uuid, p_reason text default null)
returns earning_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  rec earning_requests;
begin
  update earning_requests r
    set status = 'rejected', reviewed_at = now(), review_note = nullif(trim(p_reason), '')
    from shops s
    where r.id = p_request_id and s.id = r.shop_id and s.owner_user_id = auth.uid() and r.status = 'pending'
    returning r.* into rec;
  if not found then
    raise exception 'Request not found or already reviewed';
  end if;
  return rec;
end;
$$;
revoke all on function reject_earning_request(uuid, text) from public;
grant execute on function reject_earning_request(uuid, text) to authenticated;

-- Provider view now also returns their requests and the service catalog
-- (for the record form). Return type changed, so drop and recreate.
drop function if exists get_provider_view(text);

create function get_provider_view(p_token text)
returns table (
  provider service_providers,
  earnings_json jsonb,
  payouts_json jsonb,
  requests_json jsonb,
  services_json jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  prov service_providers;
begin
  select * into prov from service_providers where device_token = p_token and claimed = true;
  if not found then
    raise exception 'Invalid or reset device token';
  end if;

  return query select
    prov,
    (select coalesce(jsonb_agg(e order by e.created_at desc), '[]'::jsonb) from earnings e where e.provider_id = prov.id),
    (select coalesce(jsonb_agg(p order by p.created_at desc), '[]'::jsonb) from payouts p where p.provider_id = prov.id),
    (select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb)
       from (select * from earning_requests where provider_id = prov.id order by created_at desc limit 50) r),
    (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'default_price', s.default_price) order by s.name), '[]'::jsonb)
       from services s where s.shop_id = prov.shop_id and s.active);
end;
$$;

revoke all on function get_provider_view(text) from public;
grant execute on function get_provider_view(text) to anon, authenticated;
