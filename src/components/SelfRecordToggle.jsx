import { useState } from 'react'
import { useShopStore } from '../store/useShopStore'

// Admin switch: may this provider record their own services (for approval)?
export default function SelfRecordToggle({ provider }) {
  const setCanSelfRecord = useShopStore((s) => s.setCanSelfRecord)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const on = !!provider.can_self_record

  const flip = async () => {
    setBusy(true)
    setError('')
    try {
      await setCanSelfRecord(provider.id, !on)
    } catch (e) {
      setError(e.message || 'Could not update.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: '#F7F5FC', borderRadius: 14, padding: '12px 14px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Let {provider.name.split(' ')[0]} record services</div>
          <div style={{ fontSize: 12, color: '#8A8A9A', marginTop: 2 }}>
            {on ? 'On — their records reach you for approval first.' : 'Off — only you can add earnings.'}
          </div>
        </div>
        <button
          onClick={flip}
          disabled={busy}
          aria-pressed={on}
          style={{
            width: 48, height: 28, borderRadius: 999, border: 'none', padding: 3, flexShrink: 0,
            background: on ? '#7C5CFC' : '#D5D2E2', opacity: busy ? 0.6 : 1, transition: 'background 150ms',
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: '50%', background: '#fff',
            transform: on ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 150ms',
          }} />
        </button>
      </div>
      {error && <div style={{ color: '#D9482B', fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  )
}
