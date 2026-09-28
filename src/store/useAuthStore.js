import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import { getDeviceToken, saveDeviceToken, clearDeviceToken } from '../lib/db'

function makeDeviceToken() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

export function normalizePhone(phone) {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits.startsWith('+') ? digits : `+${digits}`
}

// The admin's shop is the only shop this session can see (RLS), so
// "select the shop" is enough to know whether this session is the admin.
async function fetchMyShop() {
  const { data } = await supabase.from('shops').select('*').maybeSingle()
  return data || null
}

async function ensureSession() {
  const { data } = await supabase.auth.getSession()
  if (data?.session) return data.session
  const { data: anon, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return anon.session
}

export const useAuthStore = create((set, get) => ({
  role: null,           // 'owner' (the admin) | 'provider' | null
  shop: null,           // the admin's shop row
  providerId: null,     // set once claimed, provider only
  ready: false,

  init: async () => {
    // Resume the admin: a persisted session that still owns the shop.
    const { data } = await supabase.auth.getSession()
    if (data?.session) {
      const shop = await fetchMyShop().catch(() => null)
      if (shop) {
        set({ role: 'owner', shop, ready: true })
        return
      }
      // Session exists but isn't the admin (e.g. rebound to another
      // device, or setup never finished) — drop it.
      await supabase.auth.signOut()
    }
    // Otherwise, a previously-claimed provider device.
    const token = await getDeviceToken()
    if (token) {
      set({ role: 'provider', providerId: token, ready: true })
      return
    }
    set({ ready: true })
  },

  adminExists: async () => {
    const { data, error } = await supabase.rpc('admin_exists')
    if (error) throw error
    return !!data
  },

  // First run only: create the admin + shop.
  setupAdmin: async ({ name, phone, shopName }) => {
    await ensureSession()
    const { data, error } = await supabase.rpc('setup_admin', {
      p_name: name,
      p_phone: normalizePhone(phone),
      p_shop_name: shopName,
    })
    if (error) {
      await supabase.auth.signOut()
      throw error
    }
    set({ role: 'owner', shop: data })
    return data
  },

  // New/cleared device: resume as admin using the registered number.
  recoverAdmin: async ({ phone }) => {
    await ensureSession()
    const { data, error } = await supabase.rpc('recover_admin', {
      p_phone: normalizePhone(phone),
    })
    if (error) {
      await supabase.auth.signOut()
      throw error
    }
    set({ role: 'owner', shop: data })
    return data
  },

  signOutOwner: async () => {
    await supabase.auth.signOut()
    set({ role: null, shop: null })
  },

  // Called once, from the provider's device, using the phone number the
  // admin registered them with. No OTP/SMS involved.
  claimProviderAccount: async ({ phone }) => {
    const token = makeDeviceToken()
    const { data, error } = await supabase.rpc('claim_provider', {
      p_phone: normalizePhone(phone),
      p_token: token,
    })
    if (error) throw error
    await saveDeviceToken(token)
    set({ role: 'provider', providerId: data.id })
    return data
  },

  // Local-only "forget this device" — the real reset (re-enabling the
  // phone number to be claimed again) happens on the admin's side.
  forgetDevice: async () => {
    await clearDeviceToken()
    set({ role: null, providerId: null })
  },
}))
