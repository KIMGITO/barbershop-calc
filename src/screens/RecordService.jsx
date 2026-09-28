import { useEffect, useMemo, useState } from 'react'
import { useProviderStore } from '../store/useProviderStore'
import { money, dayLabel } from '../utils/activity'
import RequestStatus from '../components/RequestStatus'
import ServicePicker from '../components/ServicePicker'

// Provider: record a service you did. It goes to the admin for approval.
export default function RecordService() {
  const { provider, services, requests, submitRequest, cancelRequest } = useProviderStore()
  const [selected, setSelected] = useState([])
  const [amount, setAmount] = useState('')
  const [manual, setManual] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const chosen = useMemo(() => services.filter((s) => selected.includes(s.id)), [services, selected])
  const suggested = chosen.reduce((sum, s) => sum + Number(s.default_price || 0), 0)

  useEffect(() => { if (!manual) setAmount(suggested ? String(suggested) : '') }, [suggested, manual])

  if (!provider) return null

  if (!provider.can_self_record) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Record a service</div>
        <div style={{ color: '#8A8A9A', fontSize: 14 }}>
          Recording is turned off for your account. Ask the admin to turn it on.
        </div>
      </div>
    )
  }

  const toggle = (id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const submit = async () => {
    setError('')
    if (!amount || Number(amount) <= 0) return setError('Enter the amount.')
    setBusy(true)
    try {
      await submitRequest({ serviceIds: selected, amount: Number(amount), note })
      setSelected([]); setAmount(''); setManual(false); setNote('')
      setSent(true)
      setTimeout(() => setSent(false), 4000)
    } catch (e) {
      setError(e.message || 'Could not send. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (id) => {
    try { await cancelRequest(id) } catch (e) { setError(e.message) }
  }

  return (
    <div style={{ padding: 16, paddingBottom: 110 }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Record a service</div>
      <div style={{ fontSize: 12, color: '#8A8A9A', marginBottom: 16 }}>
        The admin reviews it first. It counts toward your earnings once approved.
      </div>

      {services.length > 0 && (
        <>
          <label style={{ fontSize: 12, color: '#8A8A9A' }}>Services (pick one or more)</label>
          <ServicePicker services={services} selected={selected} onToggle={toggle} />
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
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', margin: '6px 0 16px', fontSize: 16 }}
      />

      <label style={{ fontSize: 12, color: '#8A8A9A' }}>Note (optional)</label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything the admin should know"
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #E0DEEB', margin: '6px 0 18px', fontSize: 16 }}
      />

      {error && <div style={{ color: '#D9482B', marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {sent && <div style={{ color: '#2FA866', marginBottom: 12, fontSize: 13, fontWeight: 600 }}>Sent to the admin for approval.</div>}

      <button
        onClick={submit}
        disabled={busy || !amount}
        style={{ width: '100%', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontWeight: 700, fontSize: 15, opacity: busy || !amount ? 0.6 : 1 }}
      >
        {busy ? 'Sending…' : 'Send for approval'}
      </button>

      <div style={{ fontWeight: 700, fontSize: 15, margin: '26px 0 10px' }}>My records</div>
      {requests.map((r) => (
        <div key={r.id} style={{ background: '#fff', border: '1px solid #F0EEF7', borderRadius: 14, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {(r.services || []).length ? r.services.map((s) => s.name).join(' + ') : (r.note || 'Service')}
            </div>
            <div style={{ fontWeight: 700 }}>{money(r.amount)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <RequestStatus status={r.status} />
            <span style={{ fontSize: 12, color: '#8A8A9A' }}>
              {dayLabel(r.created_at)}, {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {r.status === 'pending' && (
              <button onClick={() => cancel(r.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#D9482B', fontSize: 12, fontWeight: 600 }}>
                Cancel
              </button>
            )}
          </div>
          {r.status === 'rejected' && r.review_note && (
            <div style={{ fontSize: 12, color: '#6E6E82', marginTop: 6 }}>Admin: {r.review_note}</div>
          )}
        </div>
      ))}
      {requests.length === 0 && <div style={{ color: '#8A8A9A', fontSize: 13 }}>Nothing sent yet.</div>}
    </div>
  )
}
