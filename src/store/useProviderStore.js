import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import { getDeviceToken } from '../lib/db'

// Data for a claimed provider's own device. Earnings/payouts are read-only;
// the only thing a provider can write is a *request*, which the admin must
// approve before it becomes a real earning.
export const useProviderStore = create((set, get) => ({
  provider: null,
  earnings: [],
  payouts: [],
  requests: [],
  services: [],
  loading: true,
  error: '',

  load: async () => {
    const token = await getDeviceToken()
    if (!token) { set({ loading: false, error: 'This device is not linked to a provider.' }); return }
    const { data, error } = await supabase.rpc('get_provider_view', { p_token: token })
    if (error || !data?.[0]) {
      // Keep whatever we already had (e.g. offline) and only flag the error.
      set({ loading: false, error: get().provider ? '' : 'Could not load your account. Ask the admin to check your access.' })
      return
    }
    set({
      provider: data[0].provider,
      earnings: data[0].earnings_json || [],
      payouts: data[0].payouts_json || [],
      requests: data[0].requests_json || [],
      services: data[0].services_json || [],
      loading: false,
      error: '',
    })
  },

  submitRequest: async ({ serviceIds, amount, note }) => {
    const token = await getDeviceToken()
    const { error } = await supabase.rpc('submit_earning_request', {
      p_token: token,
      p_service_ids: serviceIds,
      p_amount: amount,
      p_note: note || null,
    })
    if (error) throw error
    await get().load()
  },

  cancelRequest: async (id) => {
    const token = await getDeviceToken()
    const { error } = await supabase.rpc('cancel_earning_request', { p_token: token, p_request_id: id })
    if (error) throw error
    await get().load()
  },
}))
