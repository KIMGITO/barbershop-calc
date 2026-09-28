import { supabase } from './supabaseClient'
import { getPendingSyncRows, clearSyncedRow, getPendingSyncCount } from './db'
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
      try {
        // local_id has a unique constraint in Postgres, so upserting on
        // it makes retries (same row synced twice) safe and idempotent.
        // Only send real table columns. The local copy carries client-only
        // fields (e.g. `pending`) that don't exist in Postgres — PostgREST
        // rejects the whole request with a 400 if any unknown column is present.
        const { pending, ...columns } = payload
        const { error } = await supabase
          .from(table)
          .upsert({ ...columns, local_id }, { onConflict: 'local_id' })

        if (error) throw error
        await clearSyncedRow(local_id)
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
