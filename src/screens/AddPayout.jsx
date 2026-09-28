import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'
import Select from '../components/Select'
import { Screen, Button, Field, Input } from '../components/ui'
import { font } from '../theme'

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'bank', label: 'Bank' },
]

export default function AddPayout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const addPayout = useShopStore((s) => s.addPayout)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [mpesaCode, setMpesaCode] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!amount) return
    setSaving(true)
    await addPayout({ providerId: id, amount: Number(amount), method, mpesaCode: method === 'mpesa' ? mpesaCode : null, note })
    setSaving(false)
    navigate(`/provider/${id}`)
  }

  return (
    <Screen>
      <div style={{ ...type.screen, color: ink.strong, marginBottom: 20 }}>Add Payout</div>

      <Field label="Amount (KES)">
        <Input
          type="number" inputMode="decimal" value={amount}
          onChange={(e) => setAmount(e.target.value)} placeholder="0"
        />
      </Field>

      <Field label="How did you pay?">
        <Select value={method} onChange={setMethod} options={METHODS} ariaLabel="Payout method" />
      </Field>

      {method === 'mpesa' && (
        <Field label="M-Pesa confirmation code" hint="Found in the M-Pesa confirmation SMS — it proves this payout reached them.">
          <Input
            value={mpesaCode}
            onChange={(e) => setMpesaCode(e.target.value)}
            placeholder="e.g. QK7X8Y9Z1"
            autoCapitalize="characters"
            style={{ fontFamily: font.mono, letterSpacing: '0.06em' }}
          />
        </Field>
      )}

      <Field label="Note" hint="Optional — anything worth remembering later.">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Paid for the whole week"
        />
      </Field>

      <Button onClick={submit} disabled={saving || !Number(amount)}>
        {saving ? 'Saving…' : 'Save Payout'}
      </Button>
    </Screen>
  )
}
