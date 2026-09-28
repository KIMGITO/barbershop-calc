import { useState } from 'react'
import { useShopStore } from '../store/useShopStore'
import { brand, ink, line, shadow, surface, type, radius, status } from '../theme'

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
    <div
      style={{
        background: surface.card,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.lg,
        padding: '14px',
        margin: '16px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...type.handle, color: ink.strong }}>Let {provider.name.split(' ')[0]} record services</div>
          <div style={{ ...type.meta, color: ink.muted, marginTop: 2 }}>
            {on ? 'On — their records reach you for approval first.' : 'Off — only you can add earnings.'}
          </div>
        </div>
        <button
          onClick={flip}
          disabled={busy}
          role="switch"
          aria-checked={on}
          aria-label={`Let ${provider.name.split(' ')[0]} record services`}
          style={{
            width: 50, height: 30, borderRadius: 999, border: 'none', padding: 3, flexShrink: 0,
            background: on ? brand.primary : line.hair,
            opacity: busy ? 0.6 : 1, transition: 'background 150ms',
            display: 'flex', alignItems: 'center',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 24, height: 24, borderRadius: '50%', background: brand.white,
              transform: on ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 150ms',
              boxShadow: shadow.card,
            }}
          />
        </button>
      </div>
      {error && (
        <div role="alert" style={{ ...type.meta, color: status.danger.fg, marginTop: 8 }}>{error}</div>
      )}
    </div>
  )
}
