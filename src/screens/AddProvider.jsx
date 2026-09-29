import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'
import { Screen, Button, Field, Input, ErrorText } from '../components/ui'
import Avatar from '../components/Avatar'
import { type, ink, surface } from '../theme'
import { isValidPhone, normalizePhone } from '../utils/phone'

export default function AddProvider() {
  const navigate = useNavigate()
  const addProvider = useShopStore((s) => s.addProvider)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // 07…, 01…, 254… and +254… are the same number and stored in one shape, so
  // the screen shows which shape that is before it is saved.
  const normalizedPhone = normalizePhone(phone)
  const phoneReady = isValidPhone(phone)

  const submit = async () => {
    setError('')
    if (!name.trim()) return setError('Name is required.')
    if (!phone.trim()) return setError('Phone number is required — the provider claims their account with it.')
    if (!phoneReady) return setError('Enter a valid phone number, e.g. 0712 345 678.')
    setSaving(true)
    try {
      const provider = await addProvider({ name: name.trim(), phone: phone.trim(), photoUrl, roleTitle: roleTitle.trim() })
      navigate(`/provider/${provider.id}`)
    } catch (e) {
      setError(e.message || 'Could not add provider.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen style={{ padding: 20 }}>
      <div style={{ ...type.screen, color: ink.strong, marginBottom: 4 }}>Add Provider</div>
      <div style={{ ...type.meta, color: ink.muted, marginBottom: 20 }}>
        Give them their phone number afterwards — opening the app and entering it claims their account.
      </div>

      <Field label="Name" id="p-name">
        <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brian Otieno" big />
      </Field>

      <Field
        label="Phone number"
        id="p-phone"
        hint={
          phoneReady
            ? `Any format works — stored as ${normalizedPhone}.`
            : 'Any format works — 07…, 01…, 254… or +254…'
        }
      >
        <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="2547XXXXXXXX" inputMode="tel" big />
      </Field>

      <Field label="Role / title (optional)" id="p-role">
        <Input id="p-role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="e.g. Barber, Braider" big />
      </Field>

      <Field label="Photo URL (optional)" id="p-photo" hint="Leave blank to use initials instead">
        <Input id="p-photo" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" big />
      </Field>

      {photoUrl && (
        <Avatar src={photoUrl} name={name || 'Provider'} size={48} square style={{ marginBottom: 12 }} />
      )}

      <ErrorText>{error}</ErrorText>

      <Button onClick={submit} disabled={saving} full>
        {saving ? 'Saving…' : 'Add Provider'}
      </Button>
    </Screen>
  )
}
