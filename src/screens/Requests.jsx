import { useEffect, useState } from 'react'
import { Check, X, Pencil, Inbox, CheckCheck } from 'lucide-react'
import { useShopStore } from '../store/useShopStore'
import { money, dayLabel } from '../utils/activity'
import RequestStatus from '../components/RequestStatus'
import ServicePicker from '../components/ServicePicker'
import Avatar from '../components/Avatar'
import { Card, Button, Chip, Input, Field, ErrorText, EmptyState, Screen } from '../components/ui'
import { ink, line, type, status, surface, radius, shadow } from '../theme'

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
    try {
      await fn()
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const approveAsIs = () => run(() => approveRequest({ id: r.id }))
  const approveEdited = () => {
    if (!amount || Number(amount) <= 0) return setError('Enter a valid amount.')
    return run(() => approveRequest({ id: r.id, serviceIds: selected, amount: Number(amount), note }))
  }
  const reject = () => run(() => rejectRequest({ id: r.id, reason }))

  return (
    <Card style={{ marginBottom: 10, padding: '12px 14px', boxShadow: shadow.card }}>
      {/* Header Row with Avatar & Amount */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Avatar name={providerName} size={36} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                ...type.handle,
                color: ink.strong,
                textTransform: 'capitalize',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {providerName}
            </div>
            <div style={{ ...type.metaSm, color: ink.muted, marginTop: 1 }}>
              {dayLabel(r.created_at)} · {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        <div className="tnum" style={{ ...type.amount, color: status.success.fg, flexShrink: 0 }}>
          {money(r.amount)}
        </div>
      </div>

      {/* Submitted Service Badges */}
      {(r.services || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {r.services.map((s) => (
            <span
              key={s.id || s.name}
              style={{
                ...type.metaSm,
                color: ink.soft,
                background: surface.subtle,
                border: `1px solid ${line.hair}`,
                borderRadius: radius.sm,
                padding: '2px 6px',
                textTransform: 'capitalize',
              }}
            >
              {s.name}
              {s.price ? ` (${Number(s.price).toLocaleString()})` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Optional Submission Note */}
      {r.note && (
        <div style={{ ...type.metaSm, color: ink.muted, marginTop: 6, fontStyle: 'italic' }}>
          “{r.note}”
        </div>
      )}

      {/* Reviewed Status Banner */}
      {r.status !== 'pending' && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <RequestStatus status={r.status} />
          {r.review_note && <span style={{ ...type.metaSm, color: ink.muted }}>{r.review_note}</span>}
        </div>
      )}

      {/* Main Action Buttons: Pending State */}
      {r.status === 'pending' && mode === 'view' && (
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <Button
            size="sm"
            full
            icon={Check}
            onClick={approveAsIs}
            disabled={busy}
            style={{
              background: status.success.solid,
              borderColor: status.success.solid,
            }}
          >
            Approve
          </Button>
          <Button
            size="sm"
            full
            variant="soft"
            icon={Pencil}
            onClick={() => setMode('edit')}
            disabled={busy}
          >
            Edit
          </Button>
          <Button
            size="sm"
            full
            variant="ghost"
            icon={X}
            onClick={() => setMode('reject')}
            disabled={busy}
            style={{ color: status.danger.fg }}
          >
            Reject
          </Button>
        </div>
      )}

      {/* Embedded Tray: Edit Mode */}
      {r.status === 'pending' && mode === 'edit' && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: surface.subtle,
            borderRadius: radius.md,
            border: `1px solid ${line.hair}`,
          }}
        >
          <div style={{ ...type.metaSm, color: ink.muted, marginBottom: 8 }}>
            Original amount: <strong style={{ color: ink.strong }}>{money(r.amount)}</strong>
          </div>

          {services.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ ...type.metaSm, color: ink.muted, marginBottom: 4 }}>
                Services (pick one or more)
              </div>
              <ServicePicker services={services} selected={selected} onToggle={toggle} />
            </div>
          )}

          <Field label="Amount (KES)" id={`edit-req-amount-${r.id}`}>
            <Input
              id={`edit-req-amount-${r.id}`}
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setManual(true)
              }}
            />
          </Field>

          <Field label="Note (optional)" id={`edit-req-note-${r.id}`}>
            <Input
              id={`edit-req-note-${r.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Corrected selected service"
            />
          </Field>

          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <Button size="sm" full icon={Check} onClick={approveEdited} disabled={busy}>
              Save & Approve
            </Button>
            <Button size="sm" full variant="ghost" onClick={() => setMode('view')} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Embedded Tray: Reject Mode */}
      {r.status === 'pending' && mode === 'reject' && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: surface.subtle,
            borderRadius: radius.md,
            border: `1px solid ${line.hair}`,
          }}
        >
          <Field label="Reason for rejection (optional)" id={`reject-req-reason-${r.id}`}>
            <Input
              id={`reject-req-reason-${r.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Service was not performed"
            />
          </Field>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <Button
              size="sm"
              full
              variant="danger"
              icon={X}
              onClick={reject}
              disabled={busy}
            >
              Reject
            </Button>
            <Button size="sm" full variant="ghost" onClick={() => setMode('view')} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <ErrorText style={{ marginTop: 8, marginBottom: 0 }}>{error}</ErrorText>}
    </Card>
  )
}

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
      <h1 style={{ ...type.screen, color: ink.strong, margin: '0 0 2px' }}>
        Approvals
      </h1>
      <div style={{ ...type.body, color: ink.soft, marginBottom: 14 }}>
        Services recorded by your team. Nothing counts towards payouts until you approve it.
      </div>

      {/* Tabs / Filter Chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <Chip active={tab === 'pending'} onClick={() => setTab('pending')}>
          Waiting {pending.length > 0 ? `(${pending.length})` : ''}
        </Chip>
        <Chip active={tab === 'reviewed'} onClick={() => setTab('reviewed')}>
          Reviewed {reviewed.length > 0 ? `(${reviewed.length})` : ''}
        </Chip>
      </div>

      {/* Requests List */}
      {list.map((r) => (
        <RequestCard
          key={r.id}
          r={r}
          providerName={nameOf(r.provider_id)}
          services={services}
        />
      ))}

      {/* Empty States */}
      {list.length === 0 && (
        <EmptyState icon={tab === 'pending' ? Inbox : CheckCheck}>
          {tab === 'pending'
            ? 'Nothing waiting for approval. When a provider self-records a service, it will show up here.'
            : 'No reviewed records found.'}
        </EmptyState>
      )}
    </Screen>
  )
}