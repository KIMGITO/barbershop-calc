import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import { getDeviceToken, saveDeviceToken, clearDeviceToken } from '../lib/db'

function makeDeviceToken() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

export const useAuthStore = create((set, get) => ({
  role: null,           // 'owner' | 'provider' | null
  ownerSession: null,   // Supabase session, owner only
  providerId: null,     // set once claimed, provider only
  ready: false,

  init: async () => {
    // Check for an existing owner session first.
    const { data } = await supabase.auth.getSession()
    if (data?.session) {
      set({ role: 'owner', ownerSession: data.session, ready: true })
      return
    }
    // Otherwise check for a previously-claimed provider device.
    const token = await getDeviceToken()
    if (token) {
      set({ role: 'provider', providerId: token, ready: true })
      return
    }
    set({ ready: true })
  },

  signOutOwner: async () => {
    await supabase.auth.signOut()
    set({ role: null, ownerSession: null })
  },

  // Called once, from the provider's device, using the phone number the
  // owner registered them with. No OTP/SMS involved.
  claimProviderAccount: async ({ phone, shopId }) => {
    const token = makeDeviceToken()
    const { data, error } = await supabase.rpc('claim_provider', {
      p_phone: phone,
      p_shop_id: shopId,
      p_token: token,
    })
    if (error) throw error
    await saveDeviceToken(token)
    set({ role: 'provider', providerId: data.id })
    return data
  },

  // Local-only "forget this device" — the real reset (re-enabling the
  // phone number to be claimed again) happens on the owner's side.
  forgetDevice: async () => {
    await clearDeviceToken()
    set({ role: null, providerId: null })
  },
}))
