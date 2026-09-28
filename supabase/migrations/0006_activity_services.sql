-- 0006_activity_services.sql
-- An earning ("activity") can include several services. We store a
-- snapshot of what was selected (id, name, price at that moment) so the
-- audit trail stays accurate even if a service is later renamed/repriced.
-- Shape: [{"id": "...", "name": "Haircut", "price": 300}, ...]
alter table earnings
  add column if not exists services jsonb not null default '[]'::jsonb;
