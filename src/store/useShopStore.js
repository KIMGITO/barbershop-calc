import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import {
  cacheProviders,
  getCachedProviders,
  addEarningLocal,
  cacheEarning,
  getEarningsForProvider,
  addPayoutLocal,
  getPayoutsForProvider,
  updateEarningLocal,
  voidEarningLocal,
  updatePayoutLocal,
  voidPayoutLocal,
  replaceCachedServices,
  getCachedServices,
  cacheService,
  patchRowLocal,
} from '../lib/db'
import { runSync, pullRemote as pullRemoteData } from '../lib/sync'
import { useNetworkStore } from './useNetworkStore'
import { isVoided, periodTotals } from '../utils/dates'
import { normalizePhone, isValidPhone, samePhone } from '../utils/phone'

// Applies a change to one provider row in both rosters: `providers` (active
// only — the team list and totals) and `allProviders` (everyone, removed
// included — the history needs them so a deleted provider's records keep their
// name). A row in one but not the other is how a name goes blank in the feed.
const mapProvider = (s, id, fn) => ({
  providers: s.providers.map((p) => (p.id === id ? fn(p) : p)),
  allProviders: s.allProviders.map((p) => (p.id === id ? fn(p) : p)),
})

// Every provider number is stored canonically (+254712345678), whatever was
// typed — 07…, 01…, 254…, +254… — and a number that isn't dialable is refused
// rather than saved as junk (see src/utils/phone.js).
function requirePhone(phone) {
  const normalized = normalizePhone(phone)
  if (!isValidPhone(normalized)) {
    throw new Error('Enter a valid phone number, e.g. 0712 345 678')
  }
  return normalized
}

// Is this number already someone else's? Compared canonical, so a duplicate
// that differs only in format is caught here — offline, with a clear reason,
// instead of failing much later when the queued write reaches the server.
// The full roster is used because the database's unique (shop_id, phone)
// constraint counts a removed provider's number too.
function phoneTaken(roster, phone, exceptId) {
  return roster.some((p) => p.id !== exceptId && samePhone(p.phone, phone))
}

// The same rule, as the server states it: 23505 is Postgres' unique_violation,
// raised by service_providers' unique (shop_id, phone). Reached when another
// device registered the number while this one was offline, which is exactly
// the case the local check above cannot see.
function duplicatePhoneError(error) {
  if (error?.code === '23505' || /duplicate key/i.test(error?.message || '')) {
    return new Error('That phone number is already registered to another provider.')
  }
  return error
}

export const useShopStore = create((set, get) => ({
  shopId: null,
  providers: [],
  allProviders: [],         // active + removed, for history
  services: [],
  pulling: false,            // true while downloading history from the server
  requests: [],             // provider-submitted records (pending/approved/rejected)
  earningsByProvider: {},   // { [providerId]: [] }
  payoutsByProvider: {},    // { [providerId]: [] }

  setShopId: (shopId) => set({ shopId }),

  // Downloads anything the server has that this device doesn't (new phone,
  // cleared storage, provider-approved records), then refreshes the affected
  // provider logs so the history on screen includes it.
  pullRemote: async () => {
    const { shopId } = get()
    if (!shopId || get().pulling) return
    set({ pulling: true })
    try {
      const { added, providerIds } = await pullRemoteData(shopId)
      if (added > 0) {
        // Everyone on the roster, removed providers included: their records are
        // still part of the history, so a row downloaded for them has to reach
        // the screen too.
        let list = get().allProviders
        if (!list.length) {
          await get().loadProviders(shopId)
          list = get().allProviders
        }
        const targets = providerIds.length
          ? list.filter((p) => providerIds.includes(p.id))
          : list
        await Promise.all(targets.map((p) => get().loadProviderLogs(p.id)))
      }
    } catch (e) {
      // Reads are offline-friendly: keep the local history on screen and just
      // flag that the download didn't complete. It retries on the next poll.
      useNetworkStore.getState().setError(`Could not restore history: ${e.message || 'unknown error'}`)
    } finally {
      set({ pulling: false })
    }
  },

  // --- Provider self-recording ---
  setCanSelfRecord: async (providerId, value) => {
    const { error } = await supabase
      .from('service_providers')
      .update({ can_self_record: value })
      .eq('id', providerId)
    if (error) throw error
    set((s) => mapProvider(s, providerId, (p) => ({ ...p, can_self_record: value })))
    const updated = get().providers.find((p) => p.id === providerId)
    if (updated) await cacheProviders([updated])
  },

  loadRequests: async () => {
    const { shopId } = get()
    if (!shopId || !navigator.onLine) return
    const { data, error } = await supabase
      .from('earning_requests')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error && data) set({ requests: data })
  },

  // Approve (optionally with edits). The server creates the earning; we
  // save it locally too, since this device reads earnings from local storage.
  approveRequest: async ({ id, serviceIds, amount, note }) => {
    const { data, error } = await supabase.rpc('approve_earning_request', {
      p_request_id: id,
      p_service_ids: serviceIds ?? null,
      p_amount: amount ?? null,
      p_note: note ?? null,
    })
    if (error) throw error
    await cacheEarning(data)
    await get().loadProviderLogs(data.provider_id)
    await get().loadRequests()
    return data
  },

  rejectRequest: async ({ id, reason }) => {
    const { error } = await supabase.rpc('reject_earning_request', {
      p_request_id: id,
      p_reason: reason || null,
    })
    if (error) throw error
    await get().loadRequests()
  },

  addProvider: async ({ name, phone, photoUrl, roleTitle }) => {
    const { shopId, providers, allProviders } = get()
    // Stored in one canonical shape and unique after normalizing: "0712 345
    // 678" and "254712345678" are the same number, so the second one is a
    // duplicate rather than a second provider.
    const normalizedPhone = requirePhone(phone)
    if (phoneTaken(allProviders.length ? allProviders : providers, normalizedPhone)) {
      throw new Error('That phone number is already registered to another provider.')
    }
    const { data, error } = await supabase
      .from('service_providers')
      .insert({
        shop_id: shopId,
        name,
        phone: normalizedPhone,
        photo_url: photoUrl || null,
        role_title: roleTitle || 'Service Provider',
      })
      .select()
      .single()
    if (error) throw duplicatePhoneError(error)
    await cacheProviders([data])
    set((s) => ({ providers: [...s.providers, data], allProviders: [...s.allProviders, data] }))
    return data
  },

  loadServices: async (shopId) => {
    if (!shopId) return []
    if (navigator.onLine) {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('shop_id', shopId)
        .eq('active', true)
        .order('name')
      if (!error && data) await replaceCachedServices(shopId, data)
    }
    const cached = await getCachedServices(shopId)
    set({ services: cached })
    return cached
  },

  addService: async ({ name, defaultPrice }) => {
    const { shopId } = get()
    const { data, error } = await supabase
      .from('services')
      .insert({ shop_id: shopId, name, default_price: defaultPrice || null })
      .select()
      .single()
    if (error) throw error
    // Cached, not just held in memory: the price list is read from IndexedDB, so
    // a service that exists only in this state would look "no longer on the
    // list" the moment the owner edited or deleted it.
    await cacheService(data)
    set((s) => ({ services: [...s.services, data].sort((a, b) => a.name.localeCompare(b.name)) }))
    return data
  },

  // Pull the provider list from Supabase (when online) and cache locally;
  // always read back from cache so the UI works offline too.
  loadProviders: async (shopId) => {
    if (navigator.onLine) {
      const { data, error } = await supabase
        .from('service_providers')
        .select('*')
        .eq('shop_id', shopId)
        .eq('active', true)
      if (!error && data) await cacheProviders(data)
    }
    const cached = await getCachedProviders(shopId)
    // The full roster (removed providers included) is kept for the history: a
    // deleted provider's earnings stay in the audit trail, and the feed has to
    // keep showing their name.
    const roster = await getCachedProviders(shopId, { includeInactive: true })
    set({ providers: cached, allProviders: roster })
    return cached
  },

  loadProviderLogs: async (providerId) => {
    const [earnings, payouts] = await Promise.all([
      getEarningsForProvider(providerId),
      getPayoutsForProvider(providerId),
    ])
    set((s) => ({
      earningsByProvider: { ...s.earningsByProvider, [providerId]: earnings },
      payoutsByProvider: { ...s.payoutsByProvider, [providerId]: payouts },
    }))
    return { earnings, payouts }
  },

  addEarning: async ({ providerId, serviceId, services, amount, note }) => {
    const { shopId } = get()
    await addEarningLocal({ shop_id: shopId, provider_id: providerId, service_id: serviceId, services, amount, note })
    await get().loadProviderLogs(providerId)
    runSync() // fire and forget; safe if offline
  },

  addPayout: async ({ providerId, amount, method, mpesaCode, note }) => {
    const { shopId } = get()
    await addPayoutLocal({ shop_id: shopId, provider_id: providerId, amount, method, mpesa_code: mpesaCode, note })
    await get().loadProviderLogs(providerId)
    runSync()
  },

  // Edits an existing earning/payout. Like the add actions this is
  // offline-first: the local row changes immediately and the change is queued,
  // so the admin sees the correction right away even with no signal.
  updateEarning: async ({ localId, providerId, serviceId, services, amount, note }) => {
    await updateEarningLocal(localId, {
      service_id: serviceId ?? null,
      services: services ?? [],
      amount,
      note: note ?? null,
    })
    await get().loadProviderLogs(providerId)
    runSync()
  },

  updatePayout: async ({ localId, providerId, amount, method, mpesaCode, note }) => {
    await updatePayoutLocal(localId, {
      amount,
      method,
      mpesa_code: mpesaCode ?? null,
      note: note ?? null,
    })
    await get().loadProviderLogs(providerId)
    runSync()
  },

  // Removing an activity never removes the record. It is voided: it stays in the
  // list (struck through in the feed) and out of every total, here and on the
  // server. History is the audit trail — it is never cleared, on any device.
  deleteEarning: async ({ localId, providerId }) => {
    await voidEarningLocal(localId)
    await get().loadProviderLogs(providerId)
    runSync()
  },

  deletePayout: async ({ localId, providerId }) => {
    await voidPayoutLocal(localId)
    await get().loadProviderLogs(providerId)
    runSync()
  },

  // The service catalog and the team roster are queued like any other write,
  // so an owner editing them with no signal sees the change immediately and it
  // uploads when the connection returns (see patchRowLocal).
  updateService: async ({ id, name, defaultPrice }) => {
    const patch = { name, default_price: defaultPrice || null }
    const row = await patchRowLocal('services', id, patch)
    if (!row) throw new Error('That service is no longer on the list.')
    set((s) => ({
      services: s.services
        .map((x) => (x.id === id ? row : x))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    runSync()
    return row
  },

  // `active` is soft-delete: existing earnings reference the service, so the
  // row is deactivated rather than removed and history keeps resolving.
  deleteService: async (id) => {
    const row = await patchRowLocal('services', id, { active: false })
    if (!row) throw new Error('That service is no longer on the list.')
    set((s) => ({ services: s.services.filter((x) => x.id !== id) }))
    runSync()
    return row
  },

  updateProvider: async ({ id, name, phone, roleTitle, canSelfRecord }) => {
    const patch = {}
    if (name !== undefined) patch.name = name
    // service_providers.phone is NOT NULL (and unique per shop) — the provider
    // claims their device with it — so an emptied field keeps the old number
    // rather than trying to write null, which the server would reject. A real
    // edit is normalized (07…, 254…, +254… all become +254…) and checked for a
    // duplicate before it is written, so a queued change can't quietly clash
    // with a number someone already holds.
    if (phone) {
      const normalizedPhone = requirePhone(phone)
      const { providers, allProviders } = get()
      if (phoneTaken(allProviders.length ? allProviders : providers, normalizedPhone, id)) {
        throw new Error('That phone number is already registered to another provider.')
      }
      patch.phone = normalizedPhone
    }
    if (roleTitle !== undefined) patch.role_title = roleTitle || 'Service Provider'
    if (canSelfRecord !== undefined) patch.can_self_record = canSelfRecord

    const row = await patchRowLocal('providers', id, patch)
    if (!row) throw new Error('That provider is no longer on the list.')
    set((s) => mapProvider(s, id, () => row))
    runSync()
    return row
  },

  // Providers are soft-deleted for the same reason services are: earnings and
  // payouts point at them, and that history must survive the removal. The
  // database refuses any new earning or payout against an inactive provider,
  // so a stale device can never add to a balance after the fact.
  deleteProvider: async (id) => {
    const row = await patchRowLocal('providers', id, { active: false })
    if (!row) throw new Error('That provider is no longer on the list.')
    set((s) => ({
      providers: s.providers.filter((p) => p.id !== id),
      // Kept in the full roster so their name still resolves in history — they
      // are off the team list, not out of the ledger.
      allProviders: s.allProviders.map((p) => (p.id === id ? row : p)),
    }))
    runSync()
    return row
  },

  // Derived totals for one provider: earned per period, paid out, balance owed.
  providerSummary: (providerId) => {
    const earnings = get().earningsByProvider[providerId] || []
    const payouts = get().payoutsByProvider[providerId] || []
    const earned = periodTotals(earnings)
    const paid = periodTotals(payouts)
    return {
      earned,
      paid,
      owed: earned.all - paid.all,
    }
  },

  // Shop-wide totals across every cached provider's loaded logs. Voided records
  // are skipped: they are still in the history, but they no longer count.
  shopSummary: () => {
    const { providers, earningsByProvider, payoutsByProvider } = get()
    let earned = 0
    let paid = 0
    for (const p of providers) {
      earned += (earningsByProvider[p.id] || [])
        .filter((r) => !isVoided(r))
        .reduce((s, r) => s + Number(r.amount), 0)
      paid += (payoutsByProvider[p.id] || [])
        .filter((r) => !isVoided(r))
        .reduce((s, r) => s + Number(r.amount), 0)
    }
    return { earned, paid, owed: earned - paid }
  },
}))
