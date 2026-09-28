import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { Screen, Button, Field, Input, ErrorText } from '../components/ui'
import { Scissors } from 'lucide-react'
import { ink, surface, type, primaryDeep } from '../theme'

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
    <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', flexDirection: 'column' }}>
      {/* Hook band: the brand's oversized headline, on a raised panel. */}
      <div
        style={{
          background: surface.card,
          padding: 'calc(32px + env(safe-area-inset-top, 0px)) 24px 28px',
          borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
        }}
      >
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            color: primaryDeep, ...type.meta, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
          }}
        >
          <Scissors size={14} strokeWidth={2.5} aria-hidden />
          Barbershop
        </div>
        <h1 style={{ ...type.hook, color: ink.strong, margin: 0 }}>{isSetup ? 'Set up your shop' : 'Welcome back'}</h1>
      </div>

      <Screen style={{ paddingTop: 24, flex: 1 }}>
        <p style={{ ...type.body, color: ink.soft, lineHeight: 1.5, margin: '0 0 24px' }}>
          {isSetup
            ? "You'll be the admin. Your phone number is your identity — there's no password to remember."
            : 'Enter the phone number you registered with to continue on this device.'}
        </p>

        {isSetup && (
          <>
            <Field label="Your name" id="a-name">
              <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kimani" big autoComplete="name" />
            </Field>

            <Field label="Shop name" id="a-shop">
              <Input id="a-shop" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Fresh Cuts Barbershop" big />
            </Field>
          </>
        )}

        <Field label="Phone number" id="a-phone" hint="Used to sign in on any device. No SMS codes.">
          <Input
            id="a-phone" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="2547XXXXXXXX" inputMode="tel" autoComplete="tel" big
          />
        </Field>

        <ErrorText>{error}</ErrorText>

        <Button onClick={submit} disabled={loading || !canSubmit} full style={{ marginBottom: 12 }}>
          {loading ? 'Please wait…' : isSetup ? 'Create shop & continue' : 'Continue'}
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
