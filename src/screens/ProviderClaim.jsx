import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

// First-launch screen for a service provider. They enter the phone number
// the owner registered them with; if it matches an unclaimed record, this
// device is permanently bound to that provider (see claimProviderAccount).
// There is no OTP — this only works once per provider record.
export default function ProviderClaim({ shopId }) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const claimProviderAccount = useAuthStore((s) => s.claimProviderAccount)

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      await claimProviderAccount({ phone, shopId })
    } catch (e) {
      setError(e.message || 'Could not verify this phone number with the owner.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Welcome</div>
      <div style={{ color: '#8A8A9A', marginBottom: 24 }}>
        Enter the phone number the owner registered you with. This only needs to be done once — this device will stay signed in after that.
      </div>

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Phone number</label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="2547XXXXXXXX"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 16, fontSize: 16 }}
      />

      {error && <div style={{ color: '#D9482B', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <button
        onClick={submit}
        disabled={loading || !phone}
        style={{ width: '100%', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontWeight: 700 }}
      >
        {loading ? 'Verifying…' : 'Continue'}
      </button>
    </div>
  )
}
