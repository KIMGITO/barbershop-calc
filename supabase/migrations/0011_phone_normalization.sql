-- 0011_phone_normalization.sql
-- One phone number, one shape — however it was typed.
--
-- A Kenyan number gets written at least four ways: 0712345678, 0112345678,
-- 254712345678, +254 712 345 678. Stored as typed, the same provider could
-- exist twice, "unique per shop" would mean nothing, and a claim with a
-- different format than the registration would fail. So the canonical shape
-- is +254712345678 (E.164) everywhere:
--
--   1. normalize_phone()            — the one conversion, mirrored by
--                                     src/utils/phone.js on the device.
--                                     +254712345678, 254712345678, 0712345678,
--                                     0112345678, 2540712345678 and
--                                     00254712345678 all become +254712345678.
--   2. a before insert/update-of-phone trigger on the two tables that hold a
--      number, so a write that skips the app (the SQL editor, a queued row
--      from an older build) is still stored canonically.
--   3. a one-off pass over existing rows.
--   4. setup_admin / recover_admin / claim_provider re-created to normalize
--      what they receive, so every lookup matches every stored format.
--
-- The `unique (shop_id, phone)` constraint and the unique index on
-- shops.owner_phone are unchanged: they now compare canonical values, which
-- is what makes registration unique *after normalizing*.

-- --- 1. The conversion ---
-- Immutable, so it can be used in index expressions and is evaluated once per
-- row. A value with no digits yields null: there is no number to store, and
-- service_providers.phone is NOT NULL so the constraint rejects it rather
-- than silently keeping junk.
create or replace function normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    -- +254 0712 345 678 — the trunk 0 left in after the country code
    when length(digits) = 13 and left(digits, 4) = '2540' then '+254' || right(digits, 9)
    -- 254712345678 / +254712345678 — country code, 0 already dropped
    when length(digits) = 12 and left(digits, 3) = '254'  then '+' || digits
    -- 0712345678 / 0112345678 — the local form, leading 0
    when length(digits) = 10 and left(digits, 1) = '0'    then '+254' || right(digits, 9)
    -- 712345678 — local, 0 dropped. Kenyan mobiles start 7 or 1; a 9-digit
    -- number starting with anything else is left alone rather than guessed at.
    when length(digits) = 9 and left(digits, 1) in ('7', '1') then '+254' || digits
    -- anything else keeps its digits, only marked as international
    else '+' || digits
  end
  from (
    select case
      -- 00254712345678 — the international access code some diallers write
      -- instead of "+". Nothing local starts with 00, so it is always a prefix.
      when left(d, 2) = '00' then substring(d from 3)
      else d
    end as digits
    from (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as d) r
  ) d
  where digits <> '';
$$;

comment on function normalize_phone(text) is
  'Canonical E.164 form of a phone number (+254712345678). Mirrored by normalizePhone() in src/utils/phone.js.';

-- --- 2. Store canonically, whichever writer it was ---
-- Two small functions rather than one generic one: `phone` and `owner_phone`
-- live on different tables, and a shared helper would have to guess which of
-- the two a row even has.
create or replace function normalize_provider_phone()
returns trigger
language plpgsql
as $$
begin
  new.phone := normalize_phone(new.phone);
  return new;
end;
$$;

create or replace function normalize_owner_phone()
returns trigger
language plpgsql
as $$
begin
  new.owner_phone := normalize_phone(new.owner_phone);
  return new;
end;
$$;

-- `update of phone` (not every update): the trigger exists to canonicalise a
-- number that is being written, and firing on unrelated edits would mean a
-- row that pre-dates this migration can never be edited again if its old
-- format collides with a row already in canonical form — see the backfill
-- warning in part 3.
drop trigger if exists tr_normalize_provider_phone on service_providers;
create trigger tr_normalize_provider_phone
  before insert or update of phone on service_providers
  for each row execute function normalize_provider_phone();

drop trigger if exists tr_normalize_owner_phone on shops;
create trigger tr_normalize_owner_phone
  before insert or update of owner_phone on shops
  for each row execute function normalize_owner_phone();


-- --- 3. Existing rows ---
-- Idempotent: a row already in canonical form is not selected. Rows that were
-- previously stored as text are lowercased by 0009's trigger, so only digits,
-- '+' and separators are ever involved.
--
-- Two rows in one shop can differ only in format (that is the state this
-- migration exists to end). The first one converts; the second would violate
-- `unique (shop_id, phone)` and is left exactly as it was, with a warning, so
-- no provider's history is silently dropped or merged into another's. The
-- owner can resolve it in the app by editing or removing one of them.
do $$
declare
  rec record;
  fixed int := 0;
  collisions int := 0;
begin
  for rec in
    select id, phone from service_providers
    where phone is distinct from normalize_phone(phone)
  loop
    begin
      update service_providers set phone = normalize_phone(rec.phone) where id = rec.id;
      fixed := fixed + 1;
    exception
      when unique_violation then
        collisions := collisions + 1;
        raise warning 'service_providers %: % collides with an existing row once normalised; left unchanged (edit or remove one of the two in the app)',
          rec.id, rec.phone;
    end;
  end loop;

  raise notice 'phone normalisation: % service_providers row(s) updated, % collision(s) left', fixed, collisions;
end $$;

-- A single shop, so no collision is possible here beyond the unique index
-- itself, which would have stopped a duplicate owner_phone long ago.
update shops
  set owner_phone = normalize_phone(owner_phone)
  where owner_phone is distinct from normalize_phone(owner_phone);

-- --- 4. The lookups ---
-- Same bodies as before, with every `trim(p_phone)` replaced by
-- `normalize_phone(p_phone)`. Kept as create-or-replace copies of the latest
-- definitions (setup_admin from 0005, the other two from 0004) rather than a
-- new signature, so the app keeps calling the same RPCs.

create or replace function setup_admin(p_name text, p_phone text, p_shop_name text)
returns shops
language plpgsql
security definer
set search_path = public
as $$
declare
  rec shops;
  v_phone text := normalize_phone(p_phone);
begin
  if auth.uid() is null then
    raise exception 'No session';
  end if;
  if exists (select 1 from shops) then
    raise exception 'This app already has an admin';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_shop_name), '') = '' then
    raise exception 'Name, phone number and shop name are required';
  end if;
  if v_phone is null or length(v_phone) < 10 then
    raise exception 'Enter a valid phone number, e.g. 0712 345 678';
  end if;

  insert into shops (name, owner_user_id, owner_name, owner_phone)
  values (trim(p_shop_name), auth.uid(), trim(p_name), v_phone)
  returning * into rec;

  insert into service_providers (shop_id, name, phone, role_title, claimed)
  values (rec.id, trim(p_name), v_phone, 'Owner', true);

  return rec;
end;
$$;

revoke all on function setup_admin(text, text, text) from public;
grant execute on function setup_admin(text, text, text) to authenticated;

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
    where owner_phone = normalize_phone(p_phone)
    returning * into rec;

  if not found then
    raise exception 'No admin is registered with this phone number';
  end if;

  return rec;
end;
$$;

revoke all on function recover_admin(text) from public;
grant execute on function recover_admin(text) to authenticated;

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
    where phone = normalize_phone(p_phone) and claimed = false and active = true
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

revoke all on function claim_provider(text, text) from public;
grant execute on function claim_provider(text, text) to anon, authenticated;

