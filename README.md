# Barbershop App — Scaffold

React + Zustand + Capacitor, offline-first, Supabase backend. No email or
SMS is sent anywhere — owner auth is phone + password, and each service
provider "claims" their record once from their own device (see below).

## 1. Set up Supabase

1. Create a project at supabase.com.
2. Run the files in `supabase/migrations/` **in order**, either by
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

## 2b. Tests

```bash
npm test          # vitest, single run
```

`smoke.test.js` at the repo root covers the CRUD paths that are easy to break
and hard to notice by hand: editing/removing a provider (whose local store is
`providers` but whose server table is `service_providers`), adding a service and
then editing and deleting it in the same session, and removing an activity
(which must void it rather than erase it). Supabase is faked and the tests run
in Node against `fake-indexeddb` (see `vitest.setup.js`), so no project or
network is needed. `navigator.onLine` is false by default, which is what makes
the offline-first paths deterministic.

## 3. Wrap it as a native app with Capacitor

```bash
npm run build
npx cap add android   # and/or: npx cap add ios
npm run cap:sync
npm run cap:android   # opens Android Studio
```

## 3b. Release: a signed production APK / AAB

```bash
npm run release
```

That single command is the whole pipeline. It is idempotent, so run it as
often as you like — every step is either a no-op or a fix-up:

| Step | What it does |
| --- | --- |
| 1 | Checks for JDK 17+ and the Android SDK, and installs `platforms;android-35` / `build-tools;35.0.0` if they are missing (licences auto-accepted). |
| 2 | Runs `npx cap add android` if `android/` is missing (the folder is git-ignored, so a fresh clone has none). |
| 3 | Pins the toolchain: Gradle 8.14.3, AGP 8.13.0, `compileSdk`/`targetSdk` 35, 2 GB Gradle heap. |
| 4 | Wires a `signingConfigs.release` block into `android/app/build.gradle` (marker-guarded, applied once). |
| 5 | Creates `signing/release.keystore` on first run and reuses it forever after. |
| 6-7 | `npm run build` (production Vite build, reads `.env`), then `npx cap sync android`. |
| 8 | `./gradlew clean assembleRelease bundleRelease`. |
| 9 | Verifies the signature with `apksigner`, copies the artifacts to `release/`, writes `release/SHA256SUMS.txt`. |

Output lands in `release/`:

```
release/barbershop-0.1.0-1790589258.apk   # adb install -r / direct distribution
release/barbershop-0.1.0-1790589258.aab   # upload this to the Play Console
release/SHA256SUMS.txt
```

**Version numbers are automatic.** `versionName` comes from `package.json`;
`versionCode` is the current Unix timestamp, so it always increases and two
releases can never collide. Play requires a strictly increasing
`versionCode` per upload, and you never have to remember to bump a number.

**The keystore.** `signing/` holds `release.keystore` (PKCS12, RSA 2048,
alias `release`, 27-year validity) and `keystore.properties` (the
passwords). It is git-ignored, and it lives *outside* `android/` on purpose
so `npx cap add android` can never delete it.

> **Back up `signing/` somewhere private and permanent.** The signing key
> must be byte-for-byte identical for the lifetime of the app. Lose it, and
> you can no longer update the app on devices that already installed it, nor
> upload updates to the Play Console.

To use a key you already have (for example your Play upload key), point the
release at it instead of letting it generate one:

```bash
RELEASE_KEYSTORE_FILE=/secure/path/upload.jks \
RELEASE_KEYSTORE_PASSWORD=... \
RELEASE_KEY_PASSWORD=... \
RELEASE_KEY_ALIAS=upload \
npm run release
```

Other switches:

```bash
npm run release -- --dry-run        # steps 1-5 only: validate the setup, build nothing
RELEASE_TARGETS=apk npm run release # skip the AAB (faster; direct-install builds only)
```

`--dry-run` is the quickest way to see whether this machine can build, and it
never touches your keystore beyond reporting what it would do.

**Deploying the result.**

```bash
adb install -r release/barbershop-0.1.0-1790589258.apk   # a device or emulator
```

For the Play Console, upload the `.aab`, then enrol in Play App Signing.
Keep the upload key safe: after enrolling, the key you enrolled with cannot
be used to sign further updates if it is ever exposed.

**iOS.** Not covered here — `npx cap add ios` + Xcode signing, as usual.

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

## Design

All visual decisions live in two files. **`src/index.css`** holds the `:root`
palette — the only place in the app a raw colour is written down — and
**`src/theme.js`** maps that palette onto the tokens components import. No
component or page hard-codes a hex value, a font size or a radius — the bulk
of them only ever import from `theme.js`, so re-theming means editing the
`:root` block alone. `src/components/ui.jsx` holds the shared blocks
(`Button`, `Field`, `Input`, `Card`, `Pill`, `IconTile`, `EmptyState`…) and
`src/components/Select.jsx` is the app's own dropdown.

**Colour.** The palette is dark: `--background` `#000000` is the ground,
`--surface` / `--border` `#262626` are panels and lines, `--foreground`
`#fff2ea` is cream text, and a single warm accent `--primary` / `--accent`
`#e67a4c` carries links, active states and solid fills (so `primaryDeep`
now aliases `--primary`). The five supplied gradients (`--gradient-primary`,
`--gradient-dark`, `--gradient-warm`, `--gradient-soft`,
`--gradient-dark-warm`) are used for the two hero surfaces — the provider
balance card and the profile header.

Text hierarchy is derived, not invented: `--ink-soft` / `--ink-muted` /
`--ink-faint` are `--foreground` mixed toward transparency, so quiet copy
stays on-hue. `surface.wash` is `--accent` at 12% over `--surface` — a warm
active tint that reads on both the page and cards — and `surface.subtle` is
a dark well for inputs that does the same.

Success/pending/rejected stay semantically green/amber/red — the approvals
inbox depends on reading them at a glance — as dark-theme-tuned additions in
`:root` (`--success` `#34d399`, `--pending` `#fbbf24`, `--danger` `#ff6b6b`,
each with a translucent `-bg` chip fill and a `-solid` fill that carries
white text). The one exception to "variables only": native chrome (Capacitor
status bar/splash, the `theme-color` meta tag) can't resolve CSS variables,
so `src/lib/nativeShell.js` reads `--background` at runtime and the config
files match it literally.

Contrast was measured with the WCAG relative-luminance formula, not guessed.
`ink.strong` / `ink.body` clear 13:1 on both grounds, `ink.soft` 7.5:1 on
cards, `ink.muted` 4.7:1 on cards and 6.8:1 on the page, and every status
`fg` clears 5:1 on both grounds. `ink.faint` is for disabled/placeholder
text only (~2.3:1) and never carries meaning. One known exception kept as
supplied: white on `--primary` is 3.06:1 — fine for the large/bold labels it
carries, but under AA for 14px regular text.

**Type.** Roboto, self-hosted via `@fontsource/roboto` (400/500/700) so there's
no network dependency and no flash of fallback text. Sizes follow the brand's
"Element Type Baseline", mapped from its social-feed context onto this app:

| Brand role | Size | Used here |
|---|---|---|
| Usernames | 14 / **bold** | provider names, nav handles, row titles |
| Feed body | 14 / regular | descriptions, input text |
| Bio text | 14 / standard | role/title lines |
| Comments | 13 | secondary sections, empty states |
| Timestamp / likes | 11–12 | times, counts, field labels |
| Tab bar labels | 10–11 | bottom-nav micro-copy |
| Hook title | 95–160 bold | `type.hook` — `clamp(96px, 24vw, 160px)` |

The hook band is the brand's full 95–160px range, used on the two welcome
screens only (admin onboarding, provider claim) where nothing competes with
it. `24vw` reaches ~96px on a 400px phone and the upper clamp stops it at
160px on tablets/desktop. It is deliberately *not* used inside the app: a
96px line in a data feed would push every other row off the screen.

**Icons.** All icons are [Lucide](https://lucide.dev) — no emoji or glyph
characters, which render differently per platform. Icon buttons carry
`aria-label`s; decorative ones are `aria-hidden`.

**Motion.** Short (150–250ms) and disabled under
`prefers-reduced-motion: reduce`.

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
- Clears each row's `pending` flag once Supabase accepts it, so the UI
  stops showing "syncing…" instead of leaving it stuck forever.
- Queues the *operation*, not just the row: `insert`/`update` upsert on
  `local_id`, `patch` updates one catalog row by its server id, and `void`
  stamps a removed activity (see *Removing a record* below). Each entry carries
  both names it needs — the local object store (`store`) and the server table
  (`table`) — because they are not always the same: the roster is `providers`
  locally and `service_providers` on the server.

## Downloading history (server → device)

Reads used to be local-only, so a new phone (or one whose storage was
cleared) started with an empty ledger even though the records were on the
server. `pullRemote` in `src/lib/sync.js` now downloads what's missing, and
`RemotePuller` in `src/App.jsx` runs it on start, every 60s, when the app
returns to the foreground, and when the connection comes back.

- Requires `supabase/migrations/0008_pull_cursor.sql`, which adds
  `server_created_at` to `earnings`/`payouts`. It can't reuse `created_at`:
  that one is client-supplied, and approved provider requests are dated in
  the past (0007). `server_created_at` is set by the database on insert, so
  it only moves forward and works as a download cursor.
- Incremental: the cursor per table is kept in IndexedDB (`meta` store), and
  each pull re-reads a 5-minute overlap window. Saving is idempotent — rows
  are keyed by `local_id` — so re-reading is harmless.
- A row this device is still waiting to upload is never overwritten by the
  server's copy; the local edit wins until it syncs.
- Providers are unaffected: their own view already comes straight from the
  server via `get_provider_view`.
- Note this syncs inserts/updates only: nothing in the app ever deletes an
  earning or payout. Removing one writes `voided_at` instead (see *Removing a
  record* below), and that stamp downloads like any other column, so a device
  that missed the removal still ends up showing the row as deleted.

`src/components/NetworkBanner.jsx` surfaces all of this: an "Offline · N
changes waiting to sync" banner, a brief "Syncing…" state, or a "Sync
issue — will retry automatically" notice if Supabase rejects something
(check the trigger conditions in `0003_triggers.sql` first — e.g. an
inactive provider — since those are the deliberate rejection cases).

## Removing a record (delete is a void)

History is the audit trail, so nothing the owner removes is erased. Every
"delete" in the UI is a soft delete, and the row it acts on is permanent:

- **Earnings and payouts** are *voided*, not deleted: the row is stamped with
  `voided_at` locally, and that same stamp is uploaded as an `update` keyed by
  `local_id` (a `void` op in the sync queue). The record stays in the
  provider's log and in the history, struck through and labelled "Deleted", and
  is left out of every total — `isVoided()` in `src/utils/dates.js` is the one
  place that decides this. A voided row offers no edit or delete action at all.
- Two surfaces, one ledger. The **activity** surfaces (Home's "Today's
  activity", a provider's Activity Log) show what is live right now, so a
  removed record is gone from them the moment it is removed — `liveActivities()`
  in `src/utils/activity.js` is the one filter that does that, and those screens
  call it explicitly. **History** shows everything ever recorded, including the
  removed record, struck through, labelled "Deleted" and dated with the moment
  it was removed; `HistoryView` deliberately does not filter. Nothing is
  filtered inside `mergeActivities`, so a screen has to state which of the two
  it is rather than inheriting the choice.
- **Services and providers** are deactivated (`active: false`) instead of being
  removed, because earnings and payouts point at them: the name and price a
  record was booked with keep resolving for the life of the ledger. A
  deactivated provider leaves the team list (and the database refuses new
  earnings/payouts against them), but stays on the `allProviders` roster so
  their history still shows a name — see `mapProvider` in
  `src/store/useShopStore.js`.
- Both are queued as a `patch` (only the changed columns) so the same write
  works offline and is idempotent under retry.
- Requires `supabase/migrations/0010_void_activities.sql`, which adds
  `voided_at` to `earnings`/`payouts` and drops their `DELETE` policies, so
  nothing — not a stale queue entry, not any client holding the anon key — can
  clear history from the server.

## Admin identity (no passwords)

One admin per installation, identified by phone number — WhatsApp-style. The
number is matched in canonical form, so it does not matter which format it was
entered in when the shop was set up (see *Phone numbers* below).

- First launch on a fresh install → "Set up your shop" (name, shop name, phone). Runs `setup_admin`, which refuses if a shop already exists.
- Every device gets a Supabase **anonymous** session, persisted on the device, so the admin stays signed in.
- New/cleared device → "Welcome back": enter the registered number (`recover_admin`) to continue — `0712 345 678` finds a shop registered with `254712345678`.
- Providers claim their account with the number the admin registered (`claim_provider`), in any format, bound to their device.

**Setup checklist:** run `supabase/migrations/0004_admin_phone_identity.sql` and `supabase/migrations/0011_phone_normalization.sql` in the SQL editor, and turn on *Authentication → Providers → Allow anonymous sign-ins*. The Phone provider is no longer needed.

**Security note:** without an SMS code, anyone who knows the admin's number can resume as admin from another device. Add Supabase phone OTP later if that becomes a concern.

## Provider self-recording (with admin approval)

- Admin turns it on per provider (switch on the provider's page). Off by default.
- Providers get a **Record** tab: pick services, amount, note → sent as a *request*. Providers can't write earnings directly.
- Admin sees them under **Approvals** (badge on the tab and a banner on Home): approve, edit-then-approve, or reject with a reason. Approval creates the real earning, dated when it was recorded, and keeps the original submission for audit.
- Requires `supabase/migrations/0007_provider_self_recording.sql`.

## Text normalisation (lowercasing)

`supabase/migrations/0009_auto_lowercase.sql` trims and lowercases every text
value the app writes, so "Mary " and " mary" can no longer both exist and
name/phone/code lookups always match. It is a single row trigger
(`tr_auto_lowercase` → `auto_lowercase_text_fields()`) on every table in
`public`, and an event trigger puts it on tables created later too.

- It works off the row's JSON form, so there is no column list to maintain:
  string values are trimmed + lowercased, and everything else (numbers,
  booleans, dates, jsonb, arrays, nulls) is left exactly as it was. Enum-typed
  columns are skipped, because a lowercased enum label is not a value the type
  knows.
- Three columns are deliberately exempt: `device_token` and `local_id` (both
  are compared byte-for-byte against a copy on the device — see the comments at
  the top of the migration) and `photo_url` (a URL, where case is meaningful).
  Add to that list if another such column ever appears.
- Visible consequences: `role_title` and `mpesa_code` now display lowercased,
  and a differently-cased value for a constrained column (`method`, `status`,
  `source`) is accepted instead of rejected. Search is case-insensitive, so
  finding a code by its M-Pesa casing still works.
- On Supabase the SQL editor and `db push` connect as `postgres`, which is not
  guaranteed to be a superuser, and only a superuser may create an event
  trigger. That last step is wrapped in an exception handler: it warns instead
  of failing, so the migration still applies and every existing table is still
  covered. Run that part as a superuser if the warning appears.
- Idempotent: re-running it drops and re-creates the triggers instead of
  failing.

## Phone numbers (one shape, however they are typed)

The phone number is an identity in this app: it is how the admin resumes on a
new device and how a provider claims theirs. So it is stored in **one canonical
shape** and every lookup normalizes what was typed before comparing it:

```
0712345678   0712 345 678   712345678   254712345678
+254 712 345 678   2540712345678   00254712345678   →  +254712345678
```

- One implementation per side, and they mirror each other:
  `normalizePhone()` in `src/utils/phone.js` on the device and
  `normalize_phone()` in `supabase/migrations/0011_phone_normalization.sql` on
  the server. Both are pure and idempotent, so normalizing a canonical number
  changes nothing. `isValidPhone()` (a `+` and 9–15 digits, E.164's own range),
  `samePhone()` and `formatPhone()` (`0712 345 678` for display) sit alongside
  it; its unit tests are the written spec.
- Anything that isn't a Kenyan number keeps its digits behind a `+`
  (`+14155552671`), so a foreign number is stored and compared consistently
  instead of being mangled into a Kenyan one.
- **Unique after normalizing.** The existing `unique (shop_id, phone)`
  constraint and the unique index on `shops.owner_phone` are unchanged — they
  were always comparing strings, and now the strings are canonical. A second
  registration of `0712 345 678` when `254712345678` exists is refused.
- Enforced on both sides, and both sides use the same rule: the store
  (`requirePhone()` / `phoneTaken()` in `src/store/useShopStore.js` and
  `useAuthStore.js`) refuses a duplicate or an undialable number before it is
  queued, and the database's constraint is the backstop for a device that was
  offline when the number was taken (`23505` is surfaced as "already
  registered" rather than a raw Postgres error).
- Writes are canonicalized by triggers (`tr_normalize_provider_phone`,
  `tr_normalize_owner_phone`) rather than by trusting every caller, so a queue
  entry from an older build cannot write a second spelling of a number that is
  already taken. The migration backfills existing rows with the same conversion;
  if two rows in one shop differ only in format, the first converts and the
  second is **left as it was with a warning**, because `unique (shop_id, phone)`
  forbids both. Nothing is dropped or merged: the owner resolves it in the app by
  editing or removing one of them.
- The screens show which shape a number will be stored in as it is typed
  ("Any format works — stored as +254712345678"), and `formatPhone()` renders the
  local form back to the owner.
- Requires `supabase/migrations/0011_phone_normalization.sql`.
