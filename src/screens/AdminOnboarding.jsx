import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

const inputStyle = {
  width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB',
  marginBottom: 16, fontSize: 16, background: '#fff',
}

// mode 'setup'   → first launch: create the one admin + the shop.
// mode 'resume'  → admin already exists: enter the registered number to
//                  continue on this device. No password, no SMS code.
export default function AdminOnboarding({ mode, onBack }) {
  const setupAdmin = useAuthStore((s) => s.setupAdmin)
  const recoverAdmin = useAuthStore((s) => s.recoverAdmin)

  const [name, setName] = useState('')
  const [shopName, setShopName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isSetup = mode === 'setup'
  const canSubmit = isSetup ? name.trim() && shopName.trim() && phone.trim() : phone.trim()

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      if (isSetup) await setupAdmin({ name: name.trim(), phone, shopName: shopName.trim() })
      else await recoverAdmin({ phone })
    } catch (e) {
      setError(`${e.message || 'Something went wrong.'}${e.status ? ` (HTTP ${e.status})` : ''}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
        {isSetup ? 'Set up your shop' : 'Welcome back'}
      </div>
      <div style={{ color: '#8A8A9A', marginBottom: 28, fontSize: 14, lineHeight: 1.45 }}>
        {isSetup
          ? "You'll be the admin. Your phone number is your identity — there's no password to remember."
          : 'Enter the phone number you registered with to continue on this device.'}
      </div>

      {isSetup && (
        <>
          <label style={{ fontSize: 12, color: '#8A8A9A' }}>Your name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kimani" style={inputStyle} />

          <label style={{ fontSize: 12, color: '#8A8A9A' }}>Shop name</label>
          <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Fresh Cuts Barbershop" style={inputStyle} />
        </>
      )}

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Phone number</label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="2547XXXXXXXX"
        inputMode="tel"
        style={inputStyle}
      />

      {error && <div style={{ color: '#D9482B', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <button
        onClick={submit}
        disabled={loading || !canSubmit}
        style={{
          width: '100%', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 14,
          padding: 16, fontWeight: 700, marginBottom: 12, opacity: loading || !canSubmit ? 0.6 : 1,
        }}
      >
        {loading ? 'Please wait…' : isSetup ? 'Create shop & continue' : 'Continue'}
      </button>

      {onBack && (
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#8A8A9A', fontSize: 13 }}>
          Back
        </button>
      )}
    </div>
  )
}
