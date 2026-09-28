import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import { getDeviceToken } from '../lib/db'

// Read-only data for a claimed provider's own device.
export const useProviderStore = create((set, get) => ({
  provider: null,
  earnings: [],
  payouts: [],
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
      loading: false,
      error: '',
    })
  },
}))
