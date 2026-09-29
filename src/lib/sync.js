import { supabase } from './supabaseClient'
import { getPendingSyncRows, clearSyncedRow, purgeRow, getPendingSyncCount, getMeta, setMeta, putSyncedRows } from './db'
import { useNetworkStore } from '../store/useNetworkStore'

let syncing = false
let consecutiveFailures = 0
const MAX_BACKOFF_MS = 2 * 60 * 1000 // cap retries at 2 min apart

async function refreshPendingCount() {
  const count = await getPendingSyncCount()
  useNetworkStore.getState().setPendingCount(count)
}

// Pushes every queued row to Supabase. Each row is independent: one
// failing (bad data, a dropped connection mid-request, a trigger
// rejecting it) never blocks the rest of the queue, and a row is only
// removed from the queue once Supabase has actually accepted it.
export async function runSync() {
  if (syncing) return
  if (!navigator.onLine) {
    useNetworkStore.getState().setOnline(false)
    await refreshPendingCount()
    return
  }
  useNetworkStore.getState().setOnline(true)

  syncing = true
  useNetworkStore.getState().setSyncing(true)
  let anyFailure = false

  try {
    const pending = await getPendingSyncRows()
    for (const row of pending) {
      const { table, payload, local_id } = row
      // Rows queued before CRUD support carry no `op`; treat those as inserts.
      const op = row.op || payload?.op || 'insert'
      try {
        // `pending` and `deleted` are client-only bookkeeping with no column in
        // Postgres. PostgREST rejects the entire request with a 400 if any
        // unknown column is present, so they are always stripped.
        const { pending: _p, deleted: _d, op: _o, ...columns } = payload

        if (op === 'delete') {
          // Deleting by local_id is idempotent: a row that never reached the
          // server (created and deleted while offline) simply matches nothing.
          const { error } = await supabase.from(table).delete().eq('local_id', local_id)
          if (error) throw error
          // The tombstone has served its purpose — drop the row so the download
          // pass can't resurrect it on the next pull, then clear the queue
          // entry. Both are required: purging without dequeuing would retry
          // this delete forever and pin the "pending" count above zero.
          await purgeRow(table, local_id)
          await clearSyncedRow(local_id)
          continue
        }

        if (op === 'patch') {
          // A catalog row (service, provider) that already exists on the
          // server, keyed by its server id — there is no local_id to upsert
          // against, and a plain update is already idempotent, so a retry
          // after a dropped response just re-applies the same columns.
          const { error } = await supabase.from(table).update(columns).eq('id', local_id)
          if (error) throw error
          await clearSyncedRow(local_id, table)
          continue
        }

        // Both 'insert' and 'update' go through an upsert on the unique
        // local_id. An update of a row that never synced yet must still create
        // it, and upserting on conflict is idempotent under retry.
        const { error } = await supabase
          .from(table)
          .upsert({ ...columns, local_id }, { onConflict: 'local_id' })

        if (error) throw error
        await clearSyncedRow(local_id, table)
      } catch (rowErr) {
        // Leave this row queued and keep going — it'll retry next pass.
        anyFailure = true
        useNetworkStore.getState().setError(rowErr.message || 'Sync failed for one entry')
      }
    }
  } catch (err) {
    anyFailure = true
    useNetworkStore.getState().setError(err.message || 'Sync failed')
  } finally {
    syncing = false
    useNetworkStore.getState().setSyncing(false)
    await refreshPendingCount()
    if (anyFailure) {
      consecutiveFailures += 1
    } else {
      consecutiveFailures = 0
      useNetworkStore.getState().markSynced()
    }
  }
}

function backoffDelay() {
  const base = 15000 // 15s base interval
  const delay = base * Math.pow(2, consecutiveFailures)
  return Math.min(delay, MAX_BACKOFF_MS)
}

// Runs sync on a timer, immediately on regaining connectivity, and
// immediately whenever a new write is queued (see useShopStore).
// Failures back off exponentially instead of hammering Supabase.
export function startSyncLoop() {
  let cancelled = false
  const online = () => {
    useNetworkStore.getState().setOnline(true)
    runSync()
  }
  const offline = () => useNetworkStore.getState().setOnline(false)

  window.addEventListener('online', online)
  window.addEventListener('offline', offline)

  refreshPendingCount()
  runSync()

  const tick = () => {
    if (cancelled) return
    setTimeout(async () => {
      await runSync()
      tick()
    }, backoffDelay())
  }
  tick()

  return () => {
    cancelled = true
    window.removeEventListener('online', online)
    window.removeEventListener('offline', offline)
  }
}

// --- Download (server -> this device) ---
// Brings earnings/payouts that exist on the server but not on this device
// (new phone, cleared storage, provider-approved records). Incremental: it
// remembers a cursor per table and re-reads a small overlap window, which is
// safe because saving a row is idempotent (rows are keyed by local_id).

// Kept under Supabase's PostgREST max-rows (1000 by default): if the server
// returned fewer rows than we asked for, we'd mistake a truncated page for
// the end of the data and skip the rest forever.
const PAGE = 500
const OVERLAP_MS = 5 * 60 * 1000
const MAX_PASSES = 5
let pulling = false

async function pullTable(table, shopId) {
  const key = `pull_cursor_${table}_${shopId}`
  let cursor = await getMeta(key)
  const addedTotal = { added: 0, providerIds: new Set() }

  // Paging is by row offset, so a row inserted by another device *while*
  // we're paging shifts everything down by one and we skip a row. Repeating
  // the pass from the new cursor mops that up; each pass strictly advances
  // the cursor, so this always terminates.
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const since = cursor ? new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString() : null
    let newest = cursor
    let from = 0
    for (;;) {
      let q = supabase
        .from(table)
        .select('*')
        .eq('shop_id', shopId)
        .order('server_created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (since) q = q.gte('server_created_at', since)
      const { data, error } = await q
      if (error) throw error
      if (!data?.length) break
      const { added, providerIds } = await putSyncedRows(table, data)
      addedTotal.added += added
      providerIds.forEach((id) => addedTotal.providerIds.add(id))
      newest = data[data.length - 1].server_created_at
      if (data.length < PAGE) break
      from += PAGE
    }
    if (!newest || newest === cursor) break
    await setMeta(key, newest)
    cursor = newest
  }
  return { added: addedTotal.added, providerIds: [...addedTotal.providerIds] }
}

export async function pullRemote(shopId) {
  if (pulling || !shopId || !navigator.onLine) {
    return { added: 0, providerIds: [] }
  }
  pulling = true
  let added = 0
  const providerIds = new Set()
  try {
    for (const table of ['earnings', 'payouts']) {
      const result = await pullTable(table, shopId)
      added += result.added
      result.providerIds.forEach((id) => providerIds.add(id))
    }
  } finally {
    pulling = false
  }
  return { added, providerIds: [...providerIds] }
}

