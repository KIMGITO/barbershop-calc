import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'

export default function AddEarning() {
  const { id } = useParams()
  const navigate = useNavigate()
  const shopId = useShopStore((s) => s.shopId)
  const services = useShopStore((s) => s.services)
  const loadServices = useShopStore((s) => s.loadServices)
  const addEarning = useShopStore((s) => s.addEarning)

  const [selected, setSelected] = useState([])   // service ids
  const [amount, setAmount] = useState('')
  const [manual, setManual] = useState(false)    // amount edited by hand
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (shopId) loadServices(shopId) }, [shopId])

  const chosen = useMemo(() => services.filter((s) => selected.includes(s.id)), [services, selected])
  const suggested = chosen.reduce((sum, s) => sum + Number(s.default_price || 0), 0)

  // Until the amount is typed by hand, it follows the selected services.
  useEffect(() => {
    if (!manual) setAmount(suggested ? String(suggested) : '')
  }, [suggested, manual])

  const toggle = (sid) =>
    setSelected((cur) => (cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]))

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return
    setSaving(true)
    // Snapshot of what was selected, so history stays accurate even if a
    // service is renamed or repriced later.
    const snapshot = chosen.map((s) => ({ id: s.id, name: s.name, price: Number(s.default_price || 0) }))
    await addEarning({
      providerId: id,
      serviceId: snapshot.length === 1 ? snapshot[0].id : null,
      services: snapshot,
      amount: Number(amount),
      note,
    })
    setSaving(false)
    navigate(`/provider/${id}`)
  }

  return (
    <div style={{ padding: 20, paddingBottom: 110 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Add Earning</div>

      {services.length > 0 && (
        <>
          <label style={{ fontSize: 12, color: '#8A8A9A' }}>Services (pick one or more)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0 16px' }}>
            {services.map((s) => {
              const on = selected.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  style={{
                    padding: '10px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                    border: on ? '2px solid #7C5CFC' : '1px solid #E0DEEB',
                    background: on ? '#F1EBFF' : '#fff',
                  }}
                >
                  {on ? '✓ ' : ''}{s.name}{s.default_price ? ` · ${Number(s.default_price).toLocaleString()}` : ''}
                </button>
              )
            })}
          </div>
        </>
      )}

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>
        Amount (KES){!manual && suggested ? ' — from selected services' : ''}
      </label>
      <input
        type="number"
        value={amount}
        onChange={(e) => { setAmount(e.target.value); setManual(true) }}
        placeholder="e.g. 500"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 16, fontSize: 16 }}
      />

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Note (optional)</label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Regular customer, tipped extra"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 24, fontSize: 16 }}
      />

      <button
        onClick={submit}
        disabled={saving || !amount}
        style={{ width: '100%', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontWeight: 700, fontSize: 15, opacity: saving || !amount ? 0.6 : 1 }}
      >
        {saving ? 'Saving…' : 'Save Earning'}
      </button>
    </div>
  )
}
