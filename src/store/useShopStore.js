import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import {
  cacheProviders,
  getCachedProviders,
  addEarningLocal,
  getEarningsForProvider,
  addPayoutLocal,
  getPayoutsForProvider,
} from '../lib/db'
import { runSync } from '../lib/sync'
import { periodTotals } from '../utils/dates'

export const useShopStore = create((set, get) => ({
  shopId: null,
  providers: [],
  earningsByProvider: {},   // { [providerId]: [] }
  payoutsByProvider: {},    // { [providerId]: [] }

  setShopId: (shopId) => set({ shopId }),

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

  addEarning: async ({ providerId, serviceId, amount, note }) => {
    const { shopId } = get()
    await addEarningLocal({ shop_id: shopId, provider_id: providerId, service_id: serviceId, amount, note })
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
