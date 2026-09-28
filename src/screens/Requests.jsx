import { useEffect, useState } from 'react'
import { Check, X, Pencil, Inbox, CheckCheck } from 'lucide-react'
import { useShopStore } from '../store/useShopStore'
import { money, dayLabel } from '../utils/activity'
import RequestStatus from '../components/RequestStatus'
import ServicePicker from '../components/ServicePicker'
import { Card, Button, Chip, Input, Label, ErrorText, EmptyState, Screen } from '../components/ui'
import { ink, line, type, status as tone, primaryDeep, surface } from '../theme'

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

  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...type.handle, color: ink.strong }}>{providerName}</div>
          <div style={{ ...type.meta, color: ink.muted }}>
            {dayLabel(r.created_at)}, {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div className="tnum" style={{ ...type.amount, color: tone.success.fg }}>{money(r.amount)}</div>
      </div>

      {(r.services || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {r.services.map((s, i) => (
            <span key={i} style={{ background: surface.wash, color: primaryDeep, borderRadius: 8, padding: '3px 8px', ...type.metaSm, fontWeight: 600 }}>
              {s.name}{s.price ? ` · ${Number(s.price).toLocaleString()}` : ''}
            </span>
          ))}
        </div>
      )}
      {r.note && <div style={{ ...type.meta, color: ink.soft, marginTop: 8, fontStyle: 'italic' }}>“{r.note}”</div>}

      {r.status !== 'pending' && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <RequestStatus status={r.status} />
          {r.review_note && <span style={{ ...type.meta, color: ink.soft }}>{r.review_note}</span>}
        </div>
      )}

      {r.status === 'pending' && mode === 'view' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button size="sm" full icon={Check} onClick={approveAsIs} disabled={busy}
            style={{ background: tone.success.fg, borderColor: tone.success.fg }}>
            Approve
          </Button>
          <Button size="sm" full variant="soft" icon={Pencil} onClick={() => setMode('edit')} disabled={busy}>
            Edit
          </Button>
          <Button size="sm" full variant="ghost" icon={X} onClick={() => setMode('reject')} disabled={busy}
            style={{ color: tone.danger.fg }}>
            Reject
          </Button>
        </div>
      )}

      {r.status === 'pending' && mode === 'edit' && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${line.dash}` }}>
          <div style={{ ...type.metaSm, color: ink.muted, marginBottom: 2 }}>
            Approving with changes — the provider submitted {money(r.amount)}.
          </div>
          <div style={{ marginTop: 10 }}>
            <ServicePicker services={services} selected={selected} onToggle={toggle} />
          </div>
          <Label>Amount (KES)</Label>
          <Input
            type="number" inputMode="decimal"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setManual(true) }}
          />
          <div style={{ marginTop: 12 }}>
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you changed, and why" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button size="sm" full icon={Check} onClick={approveEdited} disabled={busy}>
              Approve with changes
            </Button>
            <Button size="sm" full variant="ghost" onClick={() => setMode('view')} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {r.status === 'pending' && mode === 'reject' && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${line.dash}` }}>
          <Label>Reason</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional — the provider sees this"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button size="sm" full variant="danger" icon={X} onClick={reject} disabled={busy}>
              Reject
            </Button>
            <Button size="sm" full variant="ghost" onClick={() => setMode('view')} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ErrorText style={{ marginTop: 10, marginBottom: 0 }}>{error}</ErrorText>
    </Card>
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

  return (
    <Screen>
      <div style={{ ...type.screen, color: ink.strong, marginBottom: 4 }}>Approvals</div>
      <div style={{ ...type.body, color: ink.soft, marginBottom: 14 }}>
        Services your team recorded themselves. Nothing counts until you approve it.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Chip active={tab === 'pending'} onClick={() => setTab('pending')}>
          Waiting ({pending.length})
        </Chip>
        <Chip active={tab === 'reviewed'} onClick={() => setTab('reviewed')}>
          Reviewed
        </Chip>
      </div>

      {list.map((r) => <RequestCard key={r.id} r={r} providerName={nameOf(r.provider_id)} services={services} />)}

      {list.length === 0 && (
        <EmptyState icon={tab === 'pending' ? Inbox : CheckCheck}>
          {tab === 'pending'
            ? 'Nothing waiting for approval. When a barber records a service it lands here.'
            : 'No reviewed records yet.'}
        </EmptyState>
      )}
    </Screen>
  )
}
