import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'

const METHODS = ['cash', 'mpesa', 'bank']

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
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Add Payout</div>

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Amount (KES)</label>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 16, fontSize: 16 }}
      />

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Method</label>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0 16px' }}>
        {METHODS.map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, textTransform: 'capitalize',
              border: method === m ? '2px solid #7C5CFC' : '1px solid #E0DEEB',
              background: method === m ? '#F1EBFF' : '#fff', fontWeight: 600,
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {method === 'mpesa' && (
        <>
          <label style={{ fontSize: 12, color: '#8A8A9A' }}>M-Pesa Code</label>
          <input
            value={mpesaCode}
            onChange={(e) => setMpesaCode(e.target.value)}
            placeholder="e.g. QK7X8Y9Z1"
            style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 16, fontSize: 16 }}
          />
        </>
      )}

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Note (optional)</label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 24, fontSize: 16 }}
      />

      <button
        onClick={submit}
        disabled={saving}
        style={{ width: '100%', background: '#2FA866', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontWeight: 700, fontSize: 15 }}
      >
        {saving ? 'Saving…' : 'Save Payout'}
      </button>
    </div>
  )
}
