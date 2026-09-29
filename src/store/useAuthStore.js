import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import { getDeviceToken, saveDeviceToken, clearDeviceToken } from '../lib/db'
import { normalizePhone, isValidPhone } from '../utils/phone'

function makeDeviceToken() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

// Re-exported so the one definition of "what a phone number looks like" lives
// in src/utils/phone.js, while anything that already imported it from here
// keeps working.
export { normalizePhone }

// Every RPC below takes a phone number, and every one of them is a *lookup*:
// it has to match what the server stored. Normalizing here — and refusing
// something that isn't dialable — is what makes "0712 345 678" find a row
// registered as "+254712345678" instead of silently reporting "not found".
function requirePhone(phone) {
  const normalized = normalizePhone(phone)
  if (!isValidPhone(normalized)) {
    throw new Error('Enter a valid phone number, e.g. 0712 345 678')
  }
  return normalized
}

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
  role: null,           // 'owner' | 'provider' | null
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
      // Session exists but isn't the admin — drop it.
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

  setupAdmin: async ({ name, phone, shopName }) => {
    // Before any session is created: a typo shouldn't leave an anonymous
    // session behind for a signup that never happened.
    const ownerPhone = requirePhone(phone)
    await ensureSession()
    const { data, error } = await supabase.rpc('setup_admin', {
      p_name: name,
      p_phone: ownerPhone,
      p_shop_name: shopName,
    })
    if (error) {
      await supabase.auth.signOut()
      throw error
    }
    set({ role: 'owner', shop: data })
    return data
  },

  recoverAdmin: async ({ phone }) => {
    // Same number, any format: "07…", "254…" and "+254…" all normalize to the
    // value the shop was set up with, so the lookup finds it.
    const ownerPhone = requirePhone(phone)
    await ensureSession()
    const { data, error } = await supabase.rpc('recover_admin', {
      p_phone: ownerPhone,
    })
    if (error) {
      await supabase.auth.signOut()
      throw error
    }
    set({ role: 'owner', shop: data })
    return data
  },

  /**
   * Unified sign out — inspects current role and performs the appropriate cleanup.
   */
  signOut: async () => {
    const { role } = get()

    if (role === 'owner') {
      await supabase.auth.signOut()
    } else if (role === 'provider') {
      await clearDeviceToken()
    } else {
      // General fallback to clear both if role was uncertain
      await supabase.auth.signOut().catch(() => {})
      await clearDeviceToken().catch(() => {})
    }

    set({ role: null, shop: null, providerId: null })
  },

  // Role-specific sign-out actions (aliases to maintain compatibility)
  signOutOwner: async () => {
    await supabase.auth.signOut()
    set({ role: null, shop: null })
  },

  signOutProvider: async () => {
    await clearDeviceToken()
    set({ role: null, providerId: null })
  },

  claimProviderAccount: async ({ phone }) => {
    // The row the owner registered is stored canonically, so the number is
    // normalized before the claim is sent — whatever format they typed it in.
    const registeredPhone = requirePhone(phone)
    const token = makeDeviceToken()
    const { data, error } = await supabase.rpc('claim_provider', {
      p_phone: registeredPhone,
      p_token: token,
    })
    if (error) throw error
    await saveDeviceToken(token)
    set({ role: 'provider', providerId: data.id })
    return data
  },

  forgetDevice: async () => {
    await clearDeviceToken()
    set({ role: null, providerId: null })
  },
}))