-- 0002_functions.sql
-- All three functions run as SECURITY DEFINER because service providers
-- never hold a Supabase Auth session (no OTP/SMS anywhere) — they
-- authenticate purely via a permanent device_token checked inside these
-- functions, so RLS is deliberately bypassed here and access control is
-- enforced by the function bodies instead.

-- claim_provider(): called once, from the provider's own device, using
-- the phone number the owner registered them with.
create or replace function claim_provider(p_phone text, p_shop_id uuid, p_token text)
returns service_providers
language plpgsql
security definer
set search_path = public
as $$
declare
  rec service_providers;
begin
  if p_token is null or length(p_token) < 10 then
    raise exception 'Invalid device token';
  end if;

  select * into rec from service_providers
    where phone = p_phone and shop_id = p_shop_id and claimed = false
    for update;

  if not found then
    raise exception 'A provider with this phone number is not registered or has another device registered. Please contact the shop owner to reset your access.';
  end if;

  update service_providers
    set claimed = true, device_token = p_token, updated_at = now()
    where id = rec.id
    returning * into rec;

  return rec;
end;
$$;

revoke all on function claim_provider(text, uuid, text) from public;
grant execute on function claim_provider(text, uuid, text) to anon, authenticated;

-- get_provider_view(): the provider app calls this on every launch (with
-- its stored token) instead of running a normal authenticated query.
-- Read-only by construction — it has no update/insert/delete path.
create or replace function get_provider_view(p_token text)
returns table (
  provider service_providers,
  earnings_json jsonb,
  payouts_json jsonb
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
    (select coalesce(jsonb_agg(p order by p.created_at desc), '[]'::jsonb) from payouts p where p.provider_id = prov.id);
end;
$$;

revoke all on function get_provider_view(text) from public;
grant execute on function get_provider_view(text) to anon, authenticated;

-- reset_provider_access(): owner-only — invalidates a lost/old phone so
-- the provider can claim again from a new device. Checked explicitly
-- against auth.uid() rather than relying on RLS, since this is a function
-- call, not a table write.
create or replace function reset_provider_access(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from service_providers sp
    join shops s on s.id = sp.shop_id
    where sp.id = p_provider_id and s.owner_user_id = auth.uid()
  ) then
    raise exception 'Not authorized to reset this provider';
  end if;

  update service_providers
    set claimed = false, device_token = null, updated_at = now()
    where id = p_provider_id;
end;
$$;

revoke all on function reset_provider_access(uuid) from public;
grant execute on function reset_provider_access(uuid) to authenticated;
