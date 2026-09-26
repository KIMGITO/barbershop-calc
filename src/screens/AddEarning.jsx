import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'

export default function AddEarning() {
  const { id } = useParams()
  const navigate = useNavigate()
  const shopId = useShopStore((s) => s.shopId)
  const services = useShopStore((s) => s.services)
  const loadServices = useShopStore((s) => s.loadServices)
  const addEarning = useShopStore((s) => s.addEarning)

  const [serviceId, setServiceId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (shopId) loadServices(shopId)
  }, [shopId])

  const pickService = (service) => {
    setServiceId(service.id)
    if (service.default_price) setAmount(String(service.default_price))
    setNote(service.name)
  }

  const submit = async () => {
    if (!amount) return
    setSaving(true)
    await addEarning({ providerId: id, serviceId: serviceId || null, amount: Number(amount), note })
    setSaving(false)
    navigate(`/provider/${id}`)
  }

  return (
    <div style={{ padding: 20, paddingBottom: 100 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Add Earning</div>

      {services.length > 0 && (
        <>
          <label style={{ fontSize: 12, color: '#8A8A9A' }}>Service</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0 16px' }}>
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickService(s)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: serviceId === s.id ? '2px solid #7C5CFC' : '1px solid #E0DEEB',
                  background: serviceId === s.id ? '#F1EBFF' : '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {s.name}{s.default_price ? ` · ${Number(s.default_price).toLocaleString()}` : ''}
              </button>
            ))}
          </div>
        </>
      )}

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Amount (KES)</label>
      <input
        type="number"
        value={amount}
        onChange={(e) => { setAmount(e.target.value); setServiceId('') }}
        placeholder="e.g. 500"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 16, fontSize: 16 }}
      />

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Note (optional)</label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Hair & Beard Cut"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 24, fontSize: 16 }}
      />

      <button
        onClick={submit}
        disabled={saving || !amount}
        style={{ width: '100%', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontWeight: 700, fontSize: 15 }}
      >
        {saving ? 'Saving…' : 'Save Earning'}
      </button>
    </div>
  )
}
