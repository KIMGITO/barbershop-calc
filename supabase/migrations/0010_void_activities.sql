-- 0010_void_activities.sql
-- Deleting an activity is a void, never a deletion.
--
-- History is the audit trail: a record the owner removes has to still be there
-- afterwards, with the removal itself visible. So an earning or a payout is
-- never DELETEd — it is stamped with voided_at, which the apps read to strike it
-- through in the feed and to leave it out of every total. The row, and the
-- balance it belonged to, stay exactly where they are, permanently.
--
-- The DELETE policies on both tables are dropped with it. Nothing in the client
-- issues a DELETE any more (see voidEarningLocal/voidPayoutLocal in
-- src/lib/db.js), and a DELETE policy is the one thing that would still let a
-- stale offline queue entry — or any other client holding the anon key — clear
-- history from the server.

alter table earnings add column if not exists voided_at timestamptz;
alter table payouts  add column if not exists voided_at timestamptz;

comment on column earnings.voided_at is
  'Set when the owner removes this activity. The row is never deleted — history is permanent.';
comment on column payouts.voided_at is
  'Set when the owner removes this activity. The row is never deleted — history is permanent.';

-- No index on `voided_at`: every read of the feed is by provider, by shop, or
-- by download cursor, and the apps filter voided rows out in memory as they
-- render (see isVoided in src/utils/dates.js). An index here would only add
-- write cost to a table nothing queries it from.

-- Owner access, split per command so that DELETE is not among the verbs granted
-- (the old policy was `for all`). An upsert needs both branches: the INSERT
-- check for a new row, and the UPDATE using/with-check for a conflict —
-- sync.js upserts every earning and payout on local_id.
drop policy if exists "owner full access - earnings" on earnings;
create policy "owner read - earnings" on earnings
  for select using (shop_id in (select id from shops where owner_user_id = auth.uid()));
create policy "owner insert - earnings" on earnings
  for insert with check (shop_id in (select id from shops where owner_user_id = auth.uid()));
create policy "owner update - earnings" on earnings
  for update using (shop_id in (select id from shops where owner_user_id = auth.uid()))
  with check (shop_id in (select id from shops where owner_user_id = auth.uid()));

drop policy if exists "owner full access - payouts" on payouts;
create policy "owner read - payouts" on payouts
  for select using (shop_id in (select id from shops where owner_user_id = auth.uid()));
create policy "owner insert - payouts" on payouts
  for insert with check (shop_id in (select id from shops where owner_user_id = auth.uid()));
create policy "owner update - payouts" on payouts
  for update using (shop_id in (select id from shops where owner_user_id = auth.uid()))
  with check (shop_id in (select id from shops where owner_user_id = auth.uid()));
