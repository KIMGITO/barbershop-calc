import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'
import ServicePicker from '../components/ServicePicker'
import { Screen, Button, Field, Input } from '../components/ui'
import { type, ink } from '../theme'

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
    <Screen style={{ padding: 20 }}>
      <div style={{ ...type.screen, color: ink.strong, marginBottom: 20 }}>Add Earning</div>

      {services.length > 0 && (
        <>
          <div style={{ ...type.metaSm, color: ink.muted, marginBottom: 6, letterSpacing: '0.02em' }}>
            Services (pick one or more)
          </div>
          {/* Same picker the provider side uses, so both read identically. */}
          <ServicePicker services={services} selected={selected} onToggle={toggle} />
        </>
      )}

      <Field
        label={`Amount (KES)${!manual && suggested ? ' — from selected services' : ''}`}
        id="e-amount"
      >
        <Input
          id="e-amount"
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setManual(true) }}
          placeholder="e.g. 500"
          big
        />
      </Field>

      <Field label="Note (optional)" id="e-note">
        <Input
          id="e-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Regular customer, tipped extra"
          big
        />
      </Field>

      <Button onClick={submit} disabled={saving || !amount} full>
        {saving ? 'Saving…' : 'Save Earning'}
      </Button>
    </Screen>
  )
}
