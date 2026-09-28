# Barbershop App — Scaffold

React + Zustand + Capacitor, offline-first, Supabase backend. No email or
SMS is sent anywhere — owner auth is phone + password, and each service
provider "claims" their record once from their own device (see below).

## 1. Set up Supabase

1. Create a project at supabase.com.
2. Run the three files in `supabase/migrations/` **in order**, either by
   pasting each into the SQL editor one at a time, or with the Supabase
   CLI (`supabase link` then `supabase db push` picks them up automatically
   by their numeric prefix):
   - `0001_schema.sql` — tables, constraints, indexes, and RLS policies.
     No seed/demo data is inserted anywhere.
   - `0002_functions.sql` — the three RPC functions the app calls
     (`claim_provider`, `get_provider_view`, `reset_provider_access`),
     each `SECURITY DEFINER` since providers never hold a Supabase Auth
     session.
   - `0003_triggers.sql` — `updated_at` bookkeeping, a trigger that always
     re-derives `earnings.shop_id`/`payouts.shop_id` from the provider
     (so a stale offline device can never write to the wrong shop), and a
     trigger that blocks new earnings/payouts against a deactivated
     provider.
3. In **Authentication → Providers**, enable "Phone" sign-in but you do
   **not** need to configure an SMS provider (Twilio etc.) — the app only
   uses `supabase.auth.signUp/signInWithPassword` with a phone + password,
   which doesn't require sending an OTP.
4. Copy your project's URL and anon key into a `.env` file (copy
   `.env.example` to `.env` first).

## 2. Install & run in the browser (fastest way to iterate on UI)

```bash
npm install
npm run dev
```

## 3. Wrap it as a native app with Capacitor

```bash
npm run build
npx cap add android   # and/or: npx cap add ios
npm run cap:sync
npm run cap:android   # opens Android Studio
```

## 4. First-time setup after deploying

- Sign up as the owner from the app (`OwnerLogin` screen — phone +
  password). This creates your Supabase auth user.
- Manually insert one row into `shops` for now (`owner_user_id` = your new
  auth user's id), and put that shop's `id` into `DEMO_SHOP_ID` in
  `src/App.jsx` — replace this with a real "create my shop" screen when
  you're ready to go further.
- Add service providers as rows in `service_providers` (name + phone) —
  or build the "Add Provider" screen next, it's the one piece intentionally
  left out of this first scaffold so we could confirm the auth model
  with you first.
- Hand each provider their phone number; when they open the app and enter
  it, `claim_provider` binds their device permanently. To let a provider
  set up on a **new** phone, call `reset_provider_access(provider_id)`
  (e.g. from the Supabase SQL editor for now, or wire it into an owner
  screen) — this clears the old device's access immediately.

## What's here vs. what's next

**Included:** provider list, provider detail (styled after your reference
image), add earning / add payout (with conditional M-Pesa code field),
shop-wide dashboard, full history log, owner login, provider claim +
read-only provider view, offline-first local cache (IndexedDB) with a
background sync queue.

**Natural next additions:** an "Add Provider" screen (currently DB-only),
a real "create my shop" onboarding flow instead of the hardcoded
`DEMO_SHOP_ID`, a services catalog picker in Add Earning (tap a preset
service instead of typing an amount, like the reference image), and
swapping `src/lib/db.js`'s IndexedDB calls for
`@capacitor-community/sqlite` if you want true native SQLite instead of
the WebView's IndexedDB (same function signatures, drop-in replacement).

## Notes on the offline model

Every earning/payout write goes into IndexedDB first and updates the UI
immediately — nothing waits on the network. The row is also queued in a
`sync_queue` object store; `src/lib/sync.js` then:

- Listens for the browser's `online`/`offline` events and reflects that
  in `useNetworkStore` right away (no polling needed to detect it).
- Runs on a timer that backs off exponentially (15s → 30s → … capped at
  2 min) if Supabase calls keep failing, instead of hammering it.
- Syncs each queued row independently — one bad/rejected row (e.g. a
  trigger raising an exception) never blocks the rest of the queue, and
  a row only leaves the queue once Supabase actually accepts it.
- Upserts on each row's `local_id` (unique in Postgres), so a retried or
  duplicated sync attempt never creates a duplicate record.

`src/components/NetworkBanner.jsx` surfaces all of this: an "Offline · N
changes waiting to sync" banner, a brief "Syncing…" state, or a "Sync
issue — will retry automatically" notice if Supabase rejects something
(check the trigger conditions in `0003_triggers.sql` first — e.g. an
inactive provider — since those are the deliberate rejection cases).

## Admin identity (no passwords)

One admin per installation, identified by phone number — WhatsApp-style.

- First launch on a fresh install → "Set up your shop" (name, shop name, phone). Runs `setup_admin`, which refuses if a shop already exists.
- Every device gets a Supabase **anonymous** session, persisted on the device, so the admin stays signed in.
- New/cleared device → "Welcome back": enter the registered number (`recover_admin`) to continue.
- Providers claim their account with the number the admin registered (`claim_provider`), bound to their device.

**Setup checklist:** run `supabase/migrations/0004_admin_phone_identity.sql` in the SQL editor, and turn on *Authentication → Providers → Allow anonymous sign-ins*. The Phone provider is no longer needed.

**Security note:** without an SMS code, anyone who knows the admin's number can resume as admin from another device. Add Supabase phone OTP later if that becomes a concern.

## Provider self-recording (with admin approval)

- Admin turns it on per provider (switch on the provider's page). Off by default.
- Providers get a **Record** tab: pick services, amount, note → sent as a *request*. Providers can't write earnings directly.
- Admin sees them under **Approvals** (badge on the tab and a banner on Home): approve, edit-then-approve, or reject with a reason. Approval creates the real earning, dated when it was recorded, and keeps the original submission for audit.
- Requires `supabase/migrations/0007_provider_self_recording.sql`.
