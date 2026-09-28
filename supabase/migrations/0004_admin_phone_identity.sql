-- 0004_admin_phone_identity.sql
-- Single admin, WhatsApp-style: identified by phone number, no password.
-- Each device gets a Supabase *anonymous* session (Auth -> Providers ->
-- "Allow anonymous sign-ins" must be ON). The admin's phone number is
-- stored on the shop and used to set up once and to resume on a new device.

alter table shops add column if not exists owner_name text;
alter table shops add column if not exists owner_phone text;

-- Exactly one shop / one admin per installation.
create unique index if not exists shops_single_admin on shops ((true));
create unique index if not exists shops_owner_phone_key on shops (owner_phone);

-- admin_exists(): lets the app decide between "set up" and "welcome back".
-- Returns only a boolean, so it leaks nothing.
create or replace function admin_exists()
returns boolean
language sql
security definer
set search_path = public
as $$ select exists (select 1 from shops); $$;

revoke all on function admin_exists() from public;
grant execute on function admin_exists() to anon, authenticated;

-- setup_admin(): first-run only. Fails once any shop exists.
create or replace function setup_admin(p_name text, p_phone text, p_shop_name text)
returns shops
language plpgsql
security definer
set search_path = public
as $$
declare
  rec shops;
begin
  if auth.uid() is null then
    raise exception 'No session';
  end if;
  if exists (select 1 from shops) then
    raise exception 'This app already has an admin';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' or coalesce(trim(p_shop_name), '') = '' then
    raise exception 'Name, phone number and shop name are required';
  end if;

  insert into shops (name, owner_user_id, owner_name, owner_phone)
  values (trim(p_shop_name), auth.uid(), trim(p_name), trim(p_phone))
  returning * into rec;

  return rec;
end;
$$;

revoke all on function setup_admin(text, text, text) from public;
grant execute on function setup_admin(text, text, text) to authenticated;

-- recover_admin(): resume as admin on a new/cleared device using the
-- registered phone number. Re-points the shop at this device's session.
-- NOTE: with no OTP, anyone who knows the admin's number can do this.
create or replace function recover_admin(p_phone text)
returns shops
language plpgsql
security definer
set search_path = public
as $$
declare
  rec shops;
begin
  if auth.uid() is null then
    raise exception 'No session';
  end if;

  update shops set owner_user_id = auth.uid(), updated_at = now()
    where owner_phone = trim(p_phone)
    returning * into rec;

  if not found then
    raise exception 'No admin is registered with this phone number';
  end if;

  return rec;
end;
$$;

revoke all on function recover_admin(text) from public;
grant execute on function recover_admin(text) to authenticated;

-- With a single shop, providers no longer need to send a shop id to claim.
drop function if exists claim_provider(text, uuid, text);

create or replace function claim_provider(p_phone text, p_token text)
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
    where phone = trim(p_phone) and claimed = false and active = true
    for update;

  if not found then
    raise exception 'No unclaimed provider found for this phone number';
  end if;

  update service_providers
    set claimed = true, device_token = p_token, updated_at = now()
    where id = rec.id
    returning * into rec;

  return rec;
end;
$$;

revoke all on function claim_provider(text, text) from public;
grant execute on function claim_provider(text, text) to anon, authenticated;
