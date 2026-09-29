-- 0009_auto_lowercase.sql
-- Every text value the app writes is trimmed and lowercased in one place,
-- instead of in each screen and each RPC: "Mary " and " mary" can no longer
-- both exist, and name/phone/code lookups always match. Three parts:
--
--   1. auto_lowercase_text_fields()        — the row trigger function.
--   2. a one-off pass over existing tables — attaches it everywhere now.
--   3. an event trigger on CREATE TABLE    — attaches it to future tables.
--
-- Three columns are deliberately skipped (see `exempt` in the function).
-- They are not display text: two are compared byte-for-byte against a value
-- that only ever lives on a device, and the third is a URL, where case is
-- meaningful. Lowercasing them breaks the app instead of tidying it up:
--   device_token — a provider's permanent device token. claim_provider()
--                  stores what the device sent; get_provider_view(),
--                  submit_earning_request(), cancel_earning_request() and
--                  reset_provider_access() later match it against the token
--                  read back from the device. A mismatch can't be repaired
--                  by the provider: the row is already claimed, so an admin
--                  reset is needed.
--   local_id     — the client-generated key the offline queue upserts on
--                  (`onConflict: 'local_id'`, see src/lib/sync.js). It has to
--                  match the device's copy, or every retry of a queued row
--                  inserts a second earning/payout.
--   photo_url    — a URL the admin pastes in (see AddProvider.jsx), not text
--                  anyone reads. Paths and query strings are case-sensitive,
--                  so lowering it would just 404 the avatar.
--
-- Everything else is fair game. One visible consequence: codes typed by a
-- user come back lowercased, including payouts.mpesa_code ("SGH7…" displays
-- as "sgh7…"). Add a column name to `exempt` below to keep it exactly as
-- typed.

-- --- 1. The row trigger function ---
-- Works off the row's JSON form, so there is no column list to maintain and
-- it applies to any table: string values are trimmed + lowercased, and
-- everything else (numbers, booleans, dates, jsonb, arrays, nulls) is left
-- exactly as it was.
create or replace function auto_lowercase_text_fields()
returns trigger
language plpgsql
as $$
declare
  -- left exactly as sent: see the note at the top of this file
  exempt constant text[] := array['device_token', 'local_id', 'photo_url'];
  text_columns text[];
  j_row jsonb;
  j_key text;
  j_val jsonb;
begin
  -- Which columns may be rewritten:
  --   * enum labels are case-sensitive and a lowercased one is not a value
  --     the type knows ("Owner" would fail as "owner"), so they are skipped;
  --   * generated and identity columns may not be written to at all;
  --   * the exempt columns above are left exactly as sent (see the top of
  --     this file).
  -- Plain char/varchar/text columns — and domains over them — are eligible.
  select coalesce(array_agg(a.attname), '{}'::text[])
    into text_columns
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  where a.attrelid = tg_relid
    and a.attnum > 0
    and not a.attisdropped
    and a.attgenerated = ''
    and a.attidentity = ''
    and not (a.attname = any(exempt))
    and (
      t.typname in ('text', 'varchar', 'bpchar', 'name')
      or (t.typtype = 'd' and exists (
            select 1 from pg_type b
            where b.oid = t.typbasetype
              and b.typname in ('text', 'varchar', 'bpchar', 'name')))
    );

  j_row := to_jsonb(new);

  for j_key, j_val in
    select e.key, e.value
    from jsonb_each(j_row) as e(key, value)
    where e.key = any(text_columns)
      and jsonb_typeof(e.value) = 'string'
  loop
    j_row := jsonb_set(j_row, array[j_key], to_jsonb(lower(trim(j_val #>> '{}'))));
  end loop;

  new := jsonb_populate_record(new, j_row);
  return new;
end;
$$;

-- --- 2. Attach it to every table that already exists ---
-- Re-runnable: the trigger is dropped first, so re-applying this migration
-- can't fail on "trigger already exists".
do $$
declare
  tbl record;
  attached int := 0;
begin
  for tbl in
    select c.oid::regclass as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')   -- ordinary and partitioned tables
      -- an extension's own tables are left alone: a row trigger of ours on
      -- them would fight the extension's lifecycle (drop/upgrade)
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_class'::regclass
          and d.objid = c.oid
          and d.deptype = 'e'
      )
    order by c.relname
  loop
    -- %s (not %I): a regclass value is already a correctly quoted,
    -- schema-qualified identifier wherever that is needed.
    execute format('drop trigger if exists tr_auto_lowercase on %s', tbl.name);
    execute format(
      'create trigger tr_auto_lowercase
         before insert or update on %s
         for each row execute function auto_lowercase_text_fields()',
      tbl.name
    );
    attached := attached + 1;
  end loop;

  raise notice 'auto_lowercase_text_fields() attached to % public table(s)', attached;
end $$;

-- --- 3. Attach it to tables created later ---
-- Fires after any CREATE TABLE in public and puts the same trigger on the
-- new table, so a table added in a future migration is covered without
-- having to be remembered here.
create or replace function auto_attach_lowercase_trigger()
returns event_trigger
language plpgsql
as $$
declare
  ddl record;
begin
  for ddl in
    -- the pg_class join (rather than comparing object_type to a string) is
    -- what guarantees this is really a table; relkind 'r'/'p' can't drift.
    select c.objid::regclass as name
    from pg_event_trigger_ddl_commands() c
    join pg_class k on k.oid = c.objid and k.relkind in ('r', 'p')
    where c.command_tag = 'CREATE TABLE'
      and c.schema_name = 'public'
      and not c.in_extension   -- leave an extension's own tables alone
  loop
    execute format('drop trigger if exists tr_auto_lowercase on %s', ddl.name);
    execute format(
      'create trigger tr_auto_lowercase
         before insert or update on %s
         for each row execute function auto_lowercase_text_fields()',
      ddl.name
    );
  end loop;
end;
$$;

-- Event triggers can only be created by a superuser, and there is no
-- OR REPLACE form, so: drop first, and treat "permission denied" as a
-- warning rather than an error. That matters on Supabase, where the SQL
-- editor and `db push` connect as `postgres` — not guaranteed to be a
-- superuser (see "Superuser Access and Unsupported Operations"). Steps 1-2
-- cover every existing table regardless, so a failure here must not roll
-- the rest of the migration back. Run this part as a superuser if the
-- warning shows up and future tables still need covering.
do $$
begin
  execute 'drop event trigger if exists tr_auto_attach_lowercase';
  execute $et$
    create event trigger tr_auto_attach_lowercase
      on ddl_command_end
      when tag in ('CREATE TABLE')
      execute function auto_attach_lowercase_trigger()
  $et$;
  raise notice 'event trigger tr_auto_attach_lowercase enabled (future tables covered)';
exception
  when insufficient_privilege then
    raise warning 'Could not create the event trigger (needs a superuser). Existing tables are covered; run part 3 of 0009 as a superuser to also cover tables created later.';
end $$;

