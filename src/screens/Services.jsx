import { useEffect, useState } from 'react'
import { Plus, Scissors, Tag } from 'lucide-react'
import { useShopStore } from '../store/useShopStore'
import { Screen, Card, Button, Field, Input, ErrorText, EmptyState } from '../components/ui'
import { ink, type, primaryDeep } from '../theme'

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
      <div style={{ ...type.screen, color: ink.strong, marginBottom: 16 }}>Services</div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ ...type.handle, color: ink.strong, marginBottom: 12 }}>New service</div>
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

      <div style={{ ...type.metaSm, color: ink.muted, letterSpacing: '0.02em', marginBottom: 8 }}>
        YOUR PRICE LIST ({services.length})
      </div>

      {services.map((s) => (
        <Card
          key={s.id}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 14px', marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Tag size={16} color={ink.muted} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0 }} />
            <div style={{ ...type.body, color: ink.strong, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.name}
            </div>
          </div>
          <div className="tnum" style={{ ...type.handle, color: primaryDeep, flexShrink: 0 }}>
            {s.default_price ? `KES ${Number(s.default_price).toLocaleString()}` : '—'}
          </div>
        </Card>
      ))}

      {services.length === 0 && (
        <EmptyState icon={Scissors}>
          No services yet. Add your shop's price list above — it makes recording an earning much faster.
        </EmptyState>
      )}
    </Screen>
  )
}
