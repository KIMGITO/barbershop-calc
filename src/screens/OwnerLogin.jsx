import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/useAuthStore'

// Owner keeps a real Supabase-authenticated session (they're the one
// identity that can write money data). No email/SMS: phone + password.
export default function OwnerLogin() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const init = useAuthStore((s) => s.init)

  const submit = async () => {
    setError('')
    setLoading(true)
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`
    const fn = mode === 'signin'
      ? supabase.auth.signInWithPassword({ phone: normalizedPhone, password })
      : supabase.auth.signUp({ phone: normalizedPhone, password })
    const { error } = await fn
    setLoading(false)
    if (error) {
      // Surface the real Supabase error code alongside the message — the
      // network tab only shows a generic 400/422 status, but the JSON
      // body (error.message here) names the actual cause, e.g. "Signups
      // not allowed for this instance", "Unsupported phone provider", or
      // a password-policy complaint.
      setError(`${error.message}${error.status ? ` (HTTP ${error.status})` : ''}`)
      return
    }
    await init()
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Barbershop</div>
      <div style={{ color: '#8A8A9A', marginBottom: 24 }}>Owner sign in</div>

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Phone number</label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="2547XXXXXXXX"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 16, fontSize: 16 }}
      />

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 16, fontSize: 16 }}
      />

      {error && <div style={{ color: '#D9482B', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <button
        onClick={submit}
        disabled={loading}
        style={{ width: '100%', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontWeight: 700, marginBottom: 12 }}
      >
        {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Shop Account'}
      </button>

      <button
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        style={{ background: 'none', border: 'none', color: '#7C5CFC', fontSize: 13 }}
      >
        {mode === 'signin' ? "New shop? Create an account" : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}
