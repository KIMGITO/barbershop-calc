import { useState } from 'react'
import { Check, X } from 'lucide-react'
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

  const firstName = provider?.name ? provider.name.split(' ')[0] : 'Provider'

  return (
    <div
      style={{
        background: surface.subtle,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.md,
        padding: '10px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...type.metaSm, color: ink.strong, fontWeight: 600, textTransform: 'capitalize' }}>
            Let {firstName.toLowerCase()} record own services
          </div>
          <div style={{ ...type.metaSm, color: ink.muted, marginTop: 1, fontSize: 9 }}>
            {on ? 'On  records reach you for approval first.' : 'Off  only you can add earnings.'}
          </div>
        </div>

        <button
          onClick={flip}
          disabled={busy}
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`Let ${firstName} record services`}
          style={{
            width: 38,
            height: 22,
            borderRadius: radius.pill,
            border: 'none',
            padding: 2,
            flexShrink: 0,
            background: on ? brand.primary : line.hair,
            opacity: busy ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            transition: 'background 150ms ease',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: brand.white,
              transform: on ? 'translateX(16px)' : 'translateX(0)',
              transition: 'transform 150ms ease',
              boxShadow: shadow.card,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {on ? (
              <Check size={11} strokeWidth={3.5} style={{ color: brand.primary }} />
            ) : (
              <X size={11} strokeWidth={3.5} style={{ color: ink.muted }} />
            )}
          </span>
        </button>
      </div>

      {error && (
        <div role="alert" style={{ ...type.metaSm, color: status.danger.fg, marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  )
}