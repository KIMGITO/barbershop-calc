-- 0005_admin_is_provider.sql
-- The admin also cuts hair, so they get their own service_providers row.
-- It is created pre-claimed, so claim_provider() can never hand it to
-- another phone, and it works with every existing earnings/payout path.

-- setup_admin(): same as 0004, plus the admin's own provider row.
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

  insert into service_providers (shop_id, name, phone, role_title, claimed)
  values (rec.id, trim(p_name), trim(p_phone), 'Owner', true);

  return rec;
end;
$$;

revoke all on function setup_admin(text, text, text) from public;
grant execute on function setup_admin(text, text, text) to authenticated;

-- Backfill: a shop that was already set up before this migration.
insert into service_providers (shop_id, name, phone, role_title, claimed)
select id, coalesce(owner_name, 'Owner'), owner_phone, 'Owner', true
from shops
where owner_phone is not null
on conflict (shop_id, phone) do nothing;
