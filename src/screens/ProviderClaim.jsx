import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { Screen, Button, Field, Input, ErrorText } from '../components/ui'
import { ink, surface, type, primaryDeep } from '../theme'

// First-launch screen for a service provider. They enter the phone number
// the owner registered them with; if it matches an unclaimed record, this
// device is permanently bound to that provider (see claimProviderAccount).
// There is no OTP — this only works once per provider record.
export default function ProviderClaim({ onBack }) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const claimProviderAccount = useAuthStore((s) => s.claimProviderAccount)

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      await claimProviderAccount({ phone })
    } catch (e) {
      setError(e.message || 'Could not verify this phone number with the owner.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          background: 'var(--gradient-dark-warm)',  textAlign: 'center',
          padding: 'calc(40px + env(safe-area-inset-top, 0px)) 24px 28px',
          borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
        }}
      >
       
        <h1 style={{ ...type.minHeight, color: ink.strong, margin: 0 }}>Welcome</h1>
      </div>

      <Screen style={{ paddingTop: 60, flex: 1 }}>
        <p style={{ ...type.comment, color: ink.soft, lineHeight: 1.5, margin: '0 0 24px' }}>
          Enter the phone number the owner registered you with.
        </p>

        <Field label="Phone number" id="c-phone" hint="Ask your owner if you're not sure which number they used.">
          <Input
            id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="2547XXXXXXXX" inputMode="tel" autoComplete="tel" big
          />
        </Field>

        <ErrorText>{error}</ErrorText>

        <Button onClick={submit} disabled={loading || !phone.trim()} full>
          {loading ? 'Verifying…' : 'Continue'}
        </Button>

        {onBack && (
          <button
            onClick={onBack}
            style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: ink.muted, ...type.meta, padding: 8 }}
          >
            Back
          </button>
        )}
      </Screen>
    </div>
  )
}
