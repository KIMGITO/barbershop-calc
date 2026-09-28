import { useEffect, useState } from 'react'
import { useShopStore } from '../store/useShopStore'
import { money, dayLabel } from '../utils/activity'
import RequestStatus from '../components/RequestStatus'
import ServicePicker from '../components/ServicePicker'

const inputStyle = { width: '100%', padding: 12, borderRadius: 10, border: '1px solid #E0DEEB', fontSize: 14, marginBottom: 10, background: '#fff' }

function RequestCard({ r, providerName, services }) {
  const approveRequest = useShopStore((s) => s.approveRequest)
  const rejectRequest = useShopStore((s) => s.rejectRequest)
  const [mode, setMode] = useState('view') // 'view' | 'edit' | 'reject'
  const [selected, setSelected] = useState((r.services || []).map((s) => s.id))
  const [amount, setAmount] = useState(String(r.amount))
  const [manual, setManual] = useState(true)
  const [note, setNote] = useState(r.note || '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const time = new Date(r.created_at)

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    setSelected(next)
    if (!manual) {
      const sum = services.filter((s) => next.includes(s.id)).reduce((t, s) => t + Number(s.default_price || 0), 0)
      setAmount(sum ? String(sum) : '')
    }
  }

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try { await fn() } catch (e) { setError(e.message || 'Something went wrong.') } finally { setBusy(false) }
  }

  const approveAsIs = () => run(() => approveRequest({ id: r.id }))
  const approveEdited = () => {
    if (!amount || Number(amount) <= 0) return setError('Enter a valid amount.')
    return run(() => approveRequest({ id: r.id, serviceIds: selected, amount: Number(amount), note }))
  }
  const reject = () => run(() => rejectRequest({ id: r.id, reason }))

  const btn = (bg, color) => ({ flex: 1, background: bg, color, border: 'none', borderRadius: 12, padding: '11px 0', fontWeight: 700, fontSize: 13, opacity: busy ? 0.6 : 1 })

  return (
    <div style={{ background: '#fff', border: '1px solid #F0EEF7', borderRadius: 16, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{providerName}</div>
          <div style={{ fontSize: 12, color: '#8A8A9A' }}>
            {dayLabel(r.created_at)}, {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div style={{ fontWeight: 800, color: '#2FA866' }}>{money(r.amount)}</div>
      </div>

      {(r.services || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {r.services.map((s, i) => (
            <span key={i} style={{ background: '#F1EBFF', color: '#6B4BE0', borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
              {s.name}{s.price ? ` · ${Number(s.price).toLocaleString()}` : ''}
            </span>
          ))}
        </div>
      )}
      {r.note && <div style={{ fontSize: 12, color: '#6E6E82', marginTop: 8 }}>“{r.note}”</div>}

      {r.status !== 'pending' && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <RequestStatus status={r.status} />
          {r.review_note && <span style={{ fontSize: 12, color: '#6E6E82' }}>{r.review_note}</span>}
        </div>
      )}

      {r.status === 'pending' && mode === 'view' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button disabled={busy} onClick={approveAsIs} style={btn('#7C5CFC', '#fff')}>Approve</button>
          <button disabled={busy} onClick={() => setMode('edit')} style={btn('#F1EBFF', '#7C5CFC')}>Edit</button>
          <button disabled={busy} onClick={() => setMode('reject')} style={btn('#FDECEC', '#D9482B')}>Reject</button>
        </div>
      )}

      {r.status === 'pending' && mode === 'edit' && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #E8E5F2' }}>
          <div style={{ fontSize: 12, color: '#8A8A9A' }}>Services</div>
          <ServicePicker services={services} selected={selected} onToggle={toggle} />
          <div style={{ fontSize: 12, color: '#8A8A9A', marginBottom: 6 }}>Amount (KES) — submitted {money(r.amount)}</div>
          <input type="number" value={amount} onChange={(e) => { setAmount(e.target.value); setManual(true) }} style={inputStyle} />
          <div style={{ fontSize: 12, color: '#8A8A9A', marginBottom: 6 }}>Note</div>
          <input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={approveEdited} style={btn('#7C5CFC', '#fff')}>Approve with changes</button>
            <button disabled={busy} onClick={() => setMode('view')} style={btn('#EFEFF4', '#6E6E82')}>Cancel</button>
          </div>
        </div>
      )}

      {r.status === 'pending' && mode === 'reject' && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #E8E5F2' }}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional — the provider sees this)" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={reject} style={btn('#D9482B', '#fff')}>Reject</button>
            <button disabled={busy} onClick={() => setMode('view')} style={btn('#EFEFF4', '#6E6E82')}>Cancel</button>
          </div>
        </div>
      )}

      {error && <div style={{ color: '#D9482B', fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  )
}

// Admin inbox: provider-submitted records waiting for review.
export default function Requests() {
  const shopId = useShopStore((s) => s.shopId)
  const requests = useShopStore((s) => s.requests)
  const providers = useShopStore((s) => s.providers)
  const services = useShopStore((s) => s.services)
  const loadRequests = useShopStore((s) => s.loadRequests)
  const loadProviders = useShopStore((s) => s.loadProviders)
  const loadServices = useShopStore((s) => s.loadServices)
  const [tab, setTab] = useState('pending')

  useEffect(() => {
    if (!shopId) return
    loadRequests()
    loadServices(shopId)
    if (providers.length === 0) loadProviders(shopId)
  }, [shopId])

  const nameOf = (id) => providers.find((p) => p.id === id)?.name || 'Provider'
  const pending = requests.filter((r) => r.status === 'pending')
  const reviewed = requests.filter((r) => r.status !== 'pending')
  const list = tab === 'pending' ? pending : reviewed

  const chip = (active) => ({ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: 'none', background: active ? '#7C5CFC' : '#fff', color: active ? '#fff' : '#6E6E82' })

  return (
    <div style={{ padding: 16, paddingBottom: 110 }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Approvals</div>
      <div style={{ fontSize: 12, color: '#8A8A9A', marginBottom: 14 }}>
        Services your team recorded themselves. Nothing counts until you approve it.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button style={chip(tab === 'pending')} onClick={() => setTab('pending')}>Waiting ({pending.length})</button>
        <button style={chip(tab === 'reviewed')} onClick={() => setTab('reviewed')}>Reviewed</button>
      </div>

      {list.map((r) => <RequestCard key={r.id} r={r} providerName={nameOf(r.provider_id)} services={services} />)}

      {list.length === 0 && (
        <div style={{ color: '#8A8A9A', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
          {tab === 'pending' ? 'Nothing waiting for approval.' : 'No reviewed records yet.'}
        </div>
      )}
    </div>
  )
}
