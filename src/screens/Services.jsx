import { useEffect, useState } from 'react'
import { Plus, Scissors, Tag } from 'lucide-react'
import { useShopStore } from '../store/useShopStore'
import { Screen, Card, Button, Field, Input, ErrorText, EmptyState } from '../components/ui'
import RecordActions from '../components/RecordActions'
import { ink, type, primaryDeep, line, surface, radius } from '../theme'

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
    <Screen>
      <div style={{ ...type.screen, color: ink.strong, marginBottom: 12 }}>Services</div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ ...type.handle, color: ink.strong, marginBottom: 10 }}>New service</div>
        <Field label="Service name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hair & Beard Cut"
          />
        </Field>
        <Field label="Default price (KES)" hint="Optional — you can still type a different amount when recording.">
          <Input
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 500"
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button full onClick={submit} disabled={saving || !name.trim()} icon={Plus}>
          {saving ? 'Saving…' : 'Add Service'}
        </Button>
      </Card>

      <div style={{ ...type.metaSm, color: ink.muted, letterSpacing: '0.02em', marginBottom: 6 }}>
        YOUR PRICE LIST ({services.length})
      </div>

      <div style={{ background: surface.card, border: `1px solid ${line.hair}`, borderRadius: radius.lg, overflow: 'hidden' }}>
        {services.map((s, idx) => (
          <div
            key={s.id}
            style={{
              padding: '10px 12px',
              borderBottom: idx === services.length - 1 ? 'none' : `1px solid ${line.hair}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Tag size={15} color={ink.muted} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0 }} />
                <div style={{ ...type.body, color: ink.strong, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </div>
              </div>
              <div className="tnum" style={{ ...type.handle, color: primaryDeep, flexShrink: 0 }}>
                {s.default_price ? `KES ${Number(s.default_price).toLocaleString()}` : '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <RecordActions record={{ kind: 'service', id: s.id }} data={s} />
            </div>
          </div>
        ))}
      </div>

      {services.length === 0 && (
        <EmptyState icon={Scissors}>
          No services yet. Add your shop's price list above — it makes recording an earning much faster.
        </EmptyState>
      )}
    </Screen>
  )
}
