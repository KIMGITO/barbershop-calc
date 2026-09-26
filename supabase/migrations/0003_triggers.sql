-- 0003_triggers.sql

-- --- updated_at bookkeeping ---
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger shops_set_updated_at
  before update on shops
  for each row execute function set_updated_at();

create trigger providers_set_updated_at
  before update on service_providers
  for each row execute function set_updated_at();

-- --- Integrity: earnings/payouts.shop_id is always derived from the
-- provider, never trusted from the client. This means a device that's
-- offline for a while and syncs a batch of writes can never end up with
-- a row pointing at the wrong shop, even if its local cache was stale. ---
create or replace function sync_shop_id_from_provider()
returns trigger
language plpgsql
as $$
begin
  select shop_id into new.shop_id from service_providers where id = new.provider_id;
  if new.shop_id is null then
    raise exception 'provider_id % does not exist', new.provider_id;
  end if;
  return new;
end;
$$;

create trigger earnings_sync_shop_id
  before insert or update of provider_id on earnings
  for each row execute function sync_shop_id_from_provider();

create trigger payouts_sync_shop_id
  before insert or update of provider_id on payouts
  for each row execute function sync_shop_id_from_provider();

-- --- Guard: no earnings/payouts against a deactivated provider. Keeps a
-- provider who was removed from actually accruing new numbers, even from
-- a device that synced a queued write after the fact. ---
create or replace function check_provider_active()
returns trigger
language plpgsql
as $$
declare
  is_active boolean;
begin
  select active into is_active from service_providers where id = new.provider_id;
  if not is_active then
    raise exception 'Cannot record a % for an inactive service provider', tg_table_name;
  end if;
  return new;
end;
$$;

create trigger earnings_check_active
  before insert on earnings
  for each row execute function check_provider_active();

create trigger payouts_check_active
  before insert on payouts
  for each row execute function check_provider_active();
