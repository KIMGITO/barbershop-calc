import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'

export default function AddProvider() {
  const navigate = useNavigate()
  const addProvider = useShopStore((s) => s.addProvider)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setError('')
    if (!name.trim()) return setError('Name is required.')
    if (!phone.trim()) return setError('Phone number is required — the provider claims their account with it.')
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
    <div style={{ padding: 20, paddingBottom: 100 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Add Provider</div>
      <div style={{ fontSize: 12, color: '#8A8A9A', marginBottom: 20 }}>
        Give them their phone number afterwards — opening the app and entering it claims their account.
      </div>

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Brian Otieno"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 16, fontSize: 16 }}
      />

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Phone number</label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="2547XXXXXXXX"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 16, fontSize: 16 }}
      />

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Role / title (optional)</label>
      <input
        value={roleTitle}
        onChange={(e) => setRoleTitle(e.target.value)}
        placeholder="e.g. Barber, Braider"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 16, fontSize: 16 }}
      />

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Photo URL (optional)</label>
      <input
        value={photoUrl}
        onChange={(e) => setPhotoUrl(e.target.value)}
        placeholder="Leave blank to use initials instead"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 20, fontSize: 16 }}
      />
      {photoUrl ? (
        <img src={photoUrl} alt="Preview" style={{ width: 56, height: 56, borderRadius: 16, objectFit: 'cover', marginBottom: 16, background: '#eee' }} />
      ) : null}

      {error && <div style={{ color: '#D9482B', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <button
        onClick={submit}
        disabled={saving}
        style={{ width: '100%', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontWeight: 700, fontSize: 15 }}
      >
        {saving ? 'Saving…' : 'Add Provider'}
      </button>
    </div>
  )
}
