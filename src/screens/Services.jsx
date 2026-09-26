import { useEffect, useState } from 'react'
import { useShopStore } from '../store/useShopStore'

export default function Services() {
  const shopId = useShopStore((s) => s.shopId)
  const services = useShopStore((s) => s.services)
  const loadServices = useShopStore((s) => s.loadServices)
  const addService = useShopStore((s) => s.addService)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (shopId) loadServices(shopId)
  }, [shopId])

  const submit = async () => {
    setError('')
    if (!name.trim()) return setError('Service name is required.')
    setSaving(true)
    try {
      await addService({ name: name.trim(), defaultPrice: price ? Number(price) : null })
      setName('')
      setPrice('')
    } catch (e) {
      setError(e.message || 'Could not add service.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Services</div>

      <div style={{ background: '#fff', border: '1px solid #F0EEF7', borderRadius: 16, padding: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>New service</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hair & Beard Cut"
          style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #E0DEEB', marginBottom: 10, fontSize: 14 }}
        />
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Default price, KES (optional)"
          style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #E0DEEB', marginBottom: 10, fontSize: 14 }}
        />
        {error && <div style={{ color: '#D9482B', marginBottom: 8, fontSize: 12 }}>{error}</div>}
        <button
          onClick={submit}
          disabled={saving}
          style={{ width: '100%', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14 }}
        >
          {saving ? 'Saving…' : 'Add Service'}
        </button>
      </div>

      {services.map((s) => (
        <div
          key={s.id}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #F0EEF7', borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}
        >
          <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
          <div style={{ color: '#7C5CFC', fontWeight: 700, fontSize: 14 }}>
            {s.default_price ? `KES ${Number(s.default_price).toLocaleString()}` : '—'}
          </div>
        </div>
      ))}

      {services.length === 0 && (
        <div style={{ color: '#8A8A9A', textAlign: 'center', marginTop: 20 }}>
          No services yet. Add your shop's price list above.
        </div>
      )}
    </div>
  )
}
