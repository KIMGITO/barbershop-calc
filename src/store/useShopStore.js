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
  deleteEarningLocal,
  updatePayoutLocal,
  deletePayoutLocal,
  replaceCachedServices,
  getCachedServices,
  patchRowLocal,
} from '../lib/db'
import { runSync, pullRemote as pullRemoteData } from '../lib/sync'
import { useNetworkStore } from './useNetworkStore'
import { periodTotals } from '../utils/dates'

export const useShopStore = create((set, get) => ({
  shopId: null,
  providers: [],
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
        let list = get().providers
        if (!list.length) list = await get().loadProviders(shopId)
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
    set((s) => ({
      providers: s.providers.map((p) => (p.id === providerId ? { ...p, can_self_record: value } : p)),
    }))
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

  // Providers are owner-managed metadata (name/phone/photo), written
  // directly to Supabase — not offline-queued like earnings/payouts,
  // since adding a provider requires being online to register their phone.
  addProvider: async ({ name, phone, photoUrl, roleTitle }) => {
    const { shopId } = get()
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`
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
    if (error) throw error
    await cacheProviders([data])
    set((s) => ({ providers: [...s.providers, data] }))
    return data
  },

  // Read-through, like loadProviders: the server refreshes the cache when
  // there's signal, but the list the UI renders is always the local one, so
  // the price list still opens with no connection.
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
    set({ providers: cached })
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

  // Deletes are soft until the server confirms (see deleteEarningLocal), so the
  // row vanishes from the list immediately and disappears for good after sync.
  deleteEarning: async ({ localId, providerId }) => {
    await deleteEarningLocal(localId)
    await get().loadProviderLogs(providerId)
    runSync()
  },

  deletePayout: async ({ localId, providerId }) => {
    await deletePayoutLocal(localId)
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
    // rather than trying to write null, which the server would reject.
    if (phone) patch.phone = phone
    if (roleTitle !== undefined) patch.role_title = roleTitle || 'Service Provider'
    if (canSelfRecord !== undefined) patch.can_self_record = canSelfRecord

    const row = await patchRowLocal('service_providers', id, patch)
    if (!row) throw new Error('That provider is no longer on the list.')
    set((s) => ({ providers: s.providers.map((p) => (p.id === id ? row : p)) }))
    runSync()
    return row
  },

  // Providers are soft-deleted for the same reason services are: earnings and
  // payouts point at them, and that history must survive the removal. The
  // database refuses any new earning or payout against an inactive provider,
  // so a stale device can never add to a balance after the fact.
  deleteProvider: async (id) => {
    const row = await patchRowLocal('service_providers', id, { active: false })
    if (!row) throw new Error('That provider is no longer on the list.')
    set((s) => ({ providers: s.providers.filter((p) => p.id !== id) }))
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

  // Shop-wide totals across every cached provider's loaded logs.
  shopSummary: () => {
    const { providers, earningsByProvider, payoutsByProvider } = get()
    let earned = 0
    let paid = 0
    for (const p of providers) {
      earned += (earningsByProvider[p.id] || []).reduce((s, r) => s + Number(r.amount), 0)
      paid += (payoutsByProvider[p.id] || []).reduce((s, r) => s + Number(r.amount), 0)
    }
    return { earned, paid, owed: earned - paid }
  },
}))
