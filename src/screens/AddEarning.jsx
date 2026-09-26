import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'

export default function AddEarning() {
  const { id } = useParams()
  const navigate = useNavigate()
  const addEarning = useShopStore((s) => s.addEarning)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!amount) return
    setSaving(true)
    await addEarning({ providerId: id, amount: Number(amount), note })
    setSaving(false)
    navigate(`/provider/${id}`)
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Add Earning</div>

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Amount (KES)</label>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="e.g. 500"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 16, fontSize: 16 }}
      />

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Service / note (optional)</label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Hair & Beard Cut"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 24, fontSize: 16 }}
      />

      <button
        onClick={submit}
        disabled={saving}
        style={{ width: '100%', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontWeight: 700, fontSize: 15 }}
      >
        {saving ? 'Saving…' : 'Save Earning'}
      </button>
    </div>
  )
}
