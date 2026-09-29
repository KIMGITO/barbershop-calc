// Offline-first local store using IndexedDB (via idb).
// Every write goes here FIRST and is marked pending; a background sync
// worker pushes pending rows to Supabase when online. Reads always come
// from here, never straight from the network, so the app works fully
// offline.
//
// NOTE: on a native build, you can swap this file for
// @capacitor-community/sqlite with the same function signatures below
// and nothing else in the app needs to change.

import { openDB } from 'idb'

const DB_NAME = 'barbershop-db'
const DB_VERSION = 2

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    // Split by version so an existing install is migrated in place: the v1
    // stores are only created on a fresh database, and v2 adds to them.
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const providers = db.createObjectStore('providers', { keyPath: 'id' })
        providers.createIndex('shop_id', 'shop_id')

        const earnings = db.createObjectStore('earnings', { keyPath: 'local_id' })
        earnings.createIndex('provider_id', 'provider_id')
        earnings.createIndex('created_at', 'created_at')

        const payouts = db.createObjectStore('payouts', { keyPath: 'local_id' })
        payouts.createIndex('provider_id', 'provider_id')
        payouts.createIndex('created_at', 'created_at')

        db.createObjectStore('sync_queue', { keyPath: 'local_id' })
        db.createObjectStore('meta', { keyPath: 'key' })
      }

      // v2: the service catalog is cached, so the price list can be read and
      // edited with no signal — same treatment providers already had.
      if (oldVersion < 2) {
        const services = db.createObjectStore('services', { keyPath: 'id' })
        services.createIndex('shop_id', 'shop_id')
      }
    },
  })
}

function makeLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// --- Providers (owner pulls these from Supabase and caches them) ---
export async function cacheProviders(list) {
  const db = await getDB()
  const tx = db.transaction('providers', 'readwrite')
  for (const p of list) {
    // A queued edit wins over the server copy until it syncs, or a rename made
    // offline would flicker back to the old name on the next refresh.
    const local = await tx.store.get(p.id)
    if (local?.pending) continue
    await tx.store.put(p)
  }
  await tx.done
}

// --- Services (the price list) ---
// Replaces this shop's cached catalog with what the server just returned, so a
// service deactivated on another device disappears here too. A plain upsert
// would leave the stale row behind forever. Locally-pending rows are left
// alone — a queued edit outranks the server copy until it syncs.
export async function replaceCachedServices(shopId, list) {
  const db = await getDB()
  const tx = db.transaction('services', 'readwrite')
  const keep = new Set(list.map((s) => s.id))
  for (const key of await tx.store.index('shop_id').getAllKeys(shopId)) {
    if (!keep.has(key)) await tx.store.delete(key)
  }
  for (const s of list) {
    const local = await tx.store.get(s.id)
    if (local?.pending) continue
    await tx.store.put(s)
  }
  await tx.done
}

export async function getCachedServices(shopId) {
  const db = await getDB()
  const rows = await db.getAllFromIndex('services', 'shop_id', shopId)
  return rows.filter((s) => s.active !== false).sort((a, b) => a.name.localeCompare(b.name))
}

// --- Catalog edits (services, providers) ---
// These rows are seeded on the server, so this device only ever *changes* them,
// never creates them. That rules out the local_id upsert the earnings/payouts
// queue uses, so the queue entry is keyed by the row's server id and carries
// only the changed columns as a 'patch'. Applying a patch twice is a no-op,
// which is what makes a retry after a dropped response safe.
export async function patchRowLocal(table, id, patch) {
  const db = await getDB()
  const current = await db.get(table, id)
  if (!current) return null
  const row = { ...current, ...patch, pending: true }
  await db.put(table, row)
  await db.put('sync_queue', { local_id: id, table, op: 'patch', payload: patch })
  return row
}


// Only active providers. A soft-deleted provider is still cached (so the row
// keeps its identity if it is ever restored), but it must never be handed back
// to the UI — otherwise the next offline read resurrects someone the owner
// removed, and they show up in the team list and the totals again.
export async function getCachedProviders(shopId) {
  const db = await getDB()
  const rows = await db.getAllFromIndex('providers', 'shop_id', shopId)
  return rows.filter((p) => p.active !== false)
}

// --- Earnings ---
export async function addEarningLocal({ shop_id, provider_id, service_id, services, amount, note }) {
  const db = await getDB()
  const row = {
    local_id: makeLocalId(),
    shop_id,
    provider_id,
    service_id: service_id ?? null,
    services: services ?? [],
    amount,
    note: note ?? null,
    created_at: new Date().toISOString(),
    pending: true,
  }
  await db.put('earnings', row)
  await db.put('sync_queue', { local_id: row.local_id, table: 'earnings', payload: row })
  return row
}

// Saves an earning that was created on the server (e.g. an approved
// provider request) into the local store, already synced.
export async function cacheEarning(row) {
  const db = await getDB()
  await db.put('earnings', { ...row, pending: false })
}

export async function getEarningsForProvider(providerId) {
  const db = await getDB()
  const rows = await db.getAllFromIndex('earnings', 'provider_id', providerId)
  return rows
    .filter((r) => !r.deleted)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

// Applies an edit to an earning. Works offline: the row is patched locally
// straight away and an `update` op is queued for the server. The in-place
// write is safe even if the row already synced, because the patch is a plain
// column-level merge rather than a replace.
export async function updateEarningLocal(localId, patch) {
  const db = await getDB()
  const current = await db.get('earnings', localId)
  if (!current) return null
  const row = {
    ...current,
    ...patch,
    local_id: localId,
    deleted: false,
    pending: true,
  }
  await db.put('earnings', row)
  await db.put('sync_queue', { local_id: localId, table: 'earnings', op: 'update', payload: row })
  return row
}

// Soft-deletes an earning: the row is hidden from the UI and a `delete` op is
// queued, but it is kept on disk until the server confirms. That way the delete
// survives an offline edit and the row's history stays coherent until sync.
export async function deleteEarningLocal(localId) {
  const db = await getDB()
  const current = await db.get('earnings', localId)
  if (!current) return null
  const row = { ...current, deleted: true, pending: true }
  await db.put('earnings', row)
  await db.put('sync_queue', { local_id: localId, table: 'earnings', op: 'delete', payload: { ...row, op: 'delete' } })
  return row
}

// Called after the server accepts a delete: drop the tombstone for good.
export async function purgeRow(table, localId) {
  const db = await getDB()
  await db.delete(table, localId)
}

// --- Payouts ---
export async function addPayoutLocal({ shop_id, provider_id, amount, method, mpesa_code, note }) {
  const db = await getDB()
  const row = {
    local_id: makeLocalId(),
    shop_id,
    provider_id,
    amount,
    method,
    mpesa_code: mpesa_code ?? null,
    note: note ?? null,
    created_at: new Date().toISOString(),
    pending: true,
  }
  await db.put('payouts', row)
  await db.put('sync_queue', { local_id: row.local_id, table: 'payouts', payload: row })
  return row
}

export async function getPayoutsForProvider(providerId) {
  const db = await getDB()
  const rows = await db.getAllFromIndex('payouts', 'provider_id', providerId)
  return rows
    .filter((r) => !r.deleted)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export async function updatePayoutLocal(localId, patch) {
  const db = await getDB()
  const current = await db.get('payouts', localId)
  if (!current) return null
  const row = {
    ...current,
    ...patch,
    local_id: localId,
    deleted: false,
    pending: true,
  }
  await db.put('payouts', row)
  await db.put('sync_queue', { local_id: localId, table: 'payouts', op: 'update', payload: row })
  return row
}

export async function deletePayoutLocal(localId) {
  const db = await getDB()
  const current = await db.get('payouts', localId)
  if (!current) return null
  const row = { ...current, deleted: true, pending: true }
  await db.put('payouts', row)
  await db.put('sync_queue', { local_id: localId, table: 'payouts', op: 'delete', payload: { ...row, op: 'delete' } })
  return row
}

// --- Sync ---
export async function getPendingSyncRows() {
  const db = await getDB()
  return db.getAll('sync_queue')
}

export async function getPendingSyncCount() {
  const db = await getDB()
  return db.count('sync_queue')
}

// Called once Supabase has accepted a queued row: drop it from the queue
// AND clear its `pending` flag, so the UI stops showing "syncing…".
export async function clearSyncedRow(localId, table) {
  const db = await getDB()
  await db.delete('sync_queue', localId)
  if (table) {
    const row = await db.get(table, localId)
    if (row) await db.put(table, { ...row, pending: false })
  }
}

// --- Generic key/value (used for the download cursors) ---
export async function getMeta(key) {
  const db = await getDB()
  return (await db.get('meta', key))?.value ?? null
}

export async function setMeta(key, value) {
  const db = await getDB()
  await db.put('meta', { key, value })
}

// Saves rows downloaded from the server. A row this device is still waiting
// to upload is left alone (the local copy wins until it syncs).
// Returns how many rows were new to this device, and which providers they
// belong to, so the caller only has to refresh the affected screens.
export async function putSyncedRows(table, rows) {
  const db = await getDB()
  const tx = db.transaction(table, 'readwrite')
  const providerIds = new Set()
  let added = 0
  for (const row of rows) {
    const local = await tx.store.get(row.local_id)
    if (local?.pending) continue
    if (!local) {
      added += 1
      providerIds.add(row.provider_id)
    }
    await tx.store.put({ ...row, pending: false })
  }
  await tx.done
  return { added, providerIds: [...providerIds] }
}

// --- Device token (persisted permanently for the "claim once" provider auth) ---
export async function saveDeviceToken(token) {
  const db = await getDB()
  await db.put('meta', { key: 'device_token', value: token })
}

export async function getDeviceToken() {
  const db = await getDB()
  const row = await db.get('meta', 'device_token')
  return row?.value ?? null
}

export async function clearDeviceToken() {
  const db = await getDB()
  await db.delete('meta', 'device_token')
}
