import { useEffect, useMemo, useState } from 'react'
import { useProviderStore } from '../store/useProviderStore'
import { money, dayLabel } from '../utils/activity'
import RequestStatus from '../components/RequestStatus'
import ServicePicker from '../components/ServicePicker'
import { Screen, Button, Card, Field, Input, ErrorText, EmptyState, SectionTitle } from '../components/ui'
import { Send, Receipt, Lock } from 'lucide-react'
import { ink, type, radius, status, primaryDeep } from '../theme'

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
      <Screen>
        <div style={{ ...type.screen, color: ink.strong, marginBottom: 10 }}>Record a service</div>
        <EmptyState icon={Lock}>
          Recording is turned off for your account. Ask the admin to turn it on.
        </EmptyState>
      </Screen>
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
    <Screen>
      <div style={{ ...type.screen, color: ink.strong, marginBottom: 4 }}>Record a service</div>
      <div style={{ ...type.body, color: ink.soft, marginBottom: 18 }}>
        The admin reviews it first. It counts toward your earnings once approved.
      </div>

      {services.length > 0 && (
        <Field label="Services — pick one or more">
          <ServicePicker services={services} selected={selected} onToggle={toggle} />
        </Field>
      )}

      <Field
        label="Amount (KES)"
        hint={!manual && suggested ? 'Taken from the services you picked — change it if needed.' : undefined}
      >
        <Input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setManual(true) }}
          placeholder="e.g. 500"
        />
      </Field>

      <Field label="Note (optional)">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything the admin should know"
        />
      </Field>

      <ErrorText>{error}</ErrorText>
      {sent && (
        // Announced, but politely: success shouldn't interrupt mid-task.
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: status.success.bg, color: status.success.fg,
            ...type.body, fontWeight: 600, marginBottom: 12,
            padding: '11px 14px', borderRadius: radius.md,
          }}
        >
          <Send size={15} strokeWidth={2.4} aria-hidden />
          Sent to the admin for approval.
        </div>
      )}

      <Button full icon={Send} onClick={submit} disabled={busy || !amount}>
        {busy ? 'Sending…' : 'Send for approval'}
      </Button>

      <SectionTitle>My records</SectionTitle>
      {requests.map((r) => (
        <Card key={r.id} style={{ marginBottom: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ ...type.handle, color: ink.strong }}>
              {(r.services || []).length ? r.services.map((s) => s.name).join(' + ') : (r.note || 'Service')}
            </div>
            <div className="tnum" style={{ ...type.handle, color: primaryDeep, whiteSpace: 'nowrap' }}>
              {money(r.amount)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <RequestStatus status={r.status} />
            <span style={{ ...type.meta, color: ink.muted }}>
              {dayLabel(r.created_at)}, {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {r.status === 'pending' && (
              <button
                onClick={() => cancel(r.id)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: status.danger.fg, ...type.meta, fontWeight: 700 }}
              >
                Cancel
              </button>
            )}
          </div>
          {r.status === 'rejected' && r.review_note && (
            <div style={{ ...type.meta, color: ink.soft, marginTop: 6 }}>Admin: {r.review_note}</div>
          )}
        </Card>
      ))}
      {requests.length === 0 && <EmptyState icon={Receipt}>Nothing sent yet.</EmptyState>}
    </Screen>
  )
}
