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
const DB_VERSION = 1

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
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
  await Promise.all(list.map((p) => tx.store.put(p)))
  await tx.done
}

export async function getCachedProviders(shopId) {
  const db = await getDB()
  return db.getAllFromIndex('providers', 'shop_id', shopId)
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

export async function getEarningsForProvider(providerId) {
  const db = await getDB()
  const rows = await db.getAllFromIndex('earnings', 'provider_id', providerId)
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
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
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
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

export async function clearSyncedRow(localId) {
  const db = await getDB()
  await db.delete('sync_queue', localId)
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
