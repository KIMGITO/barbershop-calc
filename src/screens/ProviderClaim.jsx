import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { Screen, Button, Field, Input, ErrorText } from '../components/ui'
import { ink, surface, type, primaryDeep } from '../theme'

// First-launch screen for a service provider. They enter the phone number
// the owner registered them with; if it matches an unclaimed record, this
// device is permanently bound to that provider (see claimProviderAccount).
// There is no OTP — this only works once per provider record.
export default function ProviderClaim() {
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
          background: surface.card,
          padding: 'calc(40px + env(safe-area-inset-top, 0px)) 24px 28px',
          borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
        }}
      >
        <div
          style={{
            color: primaryDeep, ...type.meta, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
          }}
        >
          For service providers
        </div>
        <h1 style={{ ...type.hook, color: ink.strong, margin: 0 }}>Welcome</h1>
      </div>

      <Screen style={{ paddingTop: 24, flex: 1 }}>
        <p style={{ ...type.body, color: ink.soft, lineHeight: 1.5, margin: '0 0 24px' }}>
          Enter the phone number the owner registered you with. This only needs doing once — this device stays signed in afterwards.
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
      </Screen>
    </div>
  )
}
