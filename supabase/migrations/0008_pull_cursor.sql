-- 0008_pull_cursor.sql
-- Lets a device download "everything new since last time" reliably.
-- created_at can't be used for that: it's client-supplied, and approved
-- provider requests are dated in the past (see 0007). server_created_at is
-- set by the database when the row is first stored, so it only moves
-- forward and can be trusted as a download cursor.

alter table earnings add column if not exists server_created_at timestamptz not null default now();
alter table payouts  add column if not exists server_created_at timestamptz not null default now();

-- Existing rows: treat them as stored when they were created.
update earnings set server_created_at = created_at;
update payouts  set server_created_at = created_at;

-- (shop_id, server_created_at, id) matches the pull query exactly, including
-- the tie-break on id so paging can't repeat or skip a row.
create index if not exists earnings_shop_server_created on earnings (shop_id, server_created_at, id);
create index if not exists payouts_shop_server_created  on payouts  (shop_id, server_created_at, id);
