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

  loadServices: async (shopId) => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('shop_id', shopId)
      .eq('active', true)
      .order('name')
    if (!error && data) set({ services: data })
    return data || []
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
