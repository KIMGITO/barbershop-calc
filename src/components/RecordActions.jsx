// Admin CRUD surface: the Edit / Delete pair for every record the owner owns —
// earnings, payouts, services and providers.
//
// The sheets live here, not in the "add" screens, so an edit reuses the same
// field layout as its add sibling and only the submit handler differs.
//
// Owner-only. A provider's device renders the same activity feed, so this
// component returns null for anyone who isn't the admin rather than trusting
// every call site to remember the check.
import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useShopStore } from '../store/useShopStore'
import { useAuthStore } from '../store/useAuthStore'
import ServicePicker from './ServicePicker'
import Select from './Select'
import { Button, ErrorText, Field, Input, Sheet, SheetBody, SheetFooter } from './ui'
import { brand, ink, line, surface, type, radius, status } from '../theme'
import { money } from '../utils/activity'

/** The record kinds that can be edited from a list. */
export const RECORD_KINDS = ['earning', 'payout', 'service', 'provider']

const NOUN = { earning: 'Earning', payout: 'Payout', service: 'Service', provider: 'Provider' }

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'bank', label: 'Bank' },
]

/**
 * Resolve a feed row to `{ kind, id }`. An activity's `refId` is the row's
 * local_id (falling back to its id), which is exactly what the update and
 * delete paths key on.
 */
export function editableRecord(a) {
  if (!a || !RECORD_KINDS.includes(a.kind)) return null
  const id = a.refId || a.localId || a.id
  return id ? { kind: a.kind, id } : null
}

/**
 * Seeds the edit sheet from the row being edited. Earnings and payouts arrive
 * as `activity` objects (camelCase, see utils/activity); services and providers
 * arrive as raw rows (snake_case), so each branch reads its own shape.
 *
 * The `manual` flag on an earning starts true: the stored amount was typed (or
 * already overridden), so the sheet must not overwrite it with a sum of the
 * selected services. It only starts following the selection after the owner
 * picks a service.
 */
function seed(kind, d = {}) {
  if (kind === 'earning') {
    return {
      selected: (d.services || []).map((s) => s.id),
      amount: String(d.amount ?? ''),
      note: d.note || '',
      manual: true,
    }
  }
  if (kind === 'payout') {
    return {
      amount: String(d.amount ?? ''),
      method: d.method || 'cash',
      mpesaCode: d.mpesaCode || '',
      note: d.note || '',
      manual: true,
    }
  }
  if (kind === 'service') {
    return {
      name: d.name || '',
      defaultPrice: d.default_price == null ? '' : String(d.default_price),
      manual: true,
    }
  }
  return {
    name: d.name || '',
    phone: d.phone || '',
    roleTitle: d.role_title || '',
    canSelfRecord: !!d.can_self_record,
  }
}


/**
 * @param record `{ kind, id }` — from `editableRecord()` for a feed row, or
 *   hand-built by a list screen (`{ kind: 'service', id: s.id }`).
 * @param data   the current row, used to seed the draft.
 */
export default function RecordActions({ record, data }) {
  const role = useAuthStore((s) => s.role)

  const services = useShopStore((s) => s.services)
  const loadServices = useShopStore((s) => s.loadServices)
  const shopId = useShopStore((s) => s.shopId)
  const updateEarning = useShopStore((s) => s.updateEarning)
  const updatePayout = useShopStore((s) => s.updatePayout)
  const updateService = useShopStore((s) => s.updateService)
  const updateProvider = useShopStore((s) => s.updateProvider)
  const deleteEarning = useShopStore((s) => s.deleteEarning)
  const deletePayout = useShopStore((s) => s.deletePayout)
  const deleteService = useShopStore((s) => s.deleteService)
  const deleteProvider = useShopStore((s) => s.deleteProvider)

  const [sheet, setSheet] = useState(null)   // null | 'edit' | 'delete'
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const kind = record?.kind

  // The picker needs the catalog, and this screen may not have loaded it yet.
  useEffect(() => {
    if (sheet === 'edit' && kind === 'earning' && shopId && services.length === 0) {
      loadServices(shopId)
    }
  }, [sheet, kind, shopId, services.length, loadServices])

  const close = () => {
    setSheet(null)
    setDraft(null)
    setError('')
  }

  const open = (which) => {
    setError('')
    setDraft(which === 'edit' ? seed(kind, data) : null)
    setSheet(which)
  }

  const chosen = useMemo(() => {
    if (!draft?.selected) return []
    return services.filter((s) => draft.selected.includes(s.id))
  }, [services, draft?.selected])

  const suggested = chosen.reduce((sum, s) => sum + Number(s.default_price || 0), 0)

  // Once the amount follows the selection, keep following it.
  useEffect(() => {
    if (kind === 'earning' && draft && !draft.manual) {
      setDraft((d) => (d ? { ...d, amount: suggested ? String(suggested) : '' } : d))
    }
  }, [kind, suggested, draft?.manual])

  if (role !== 'owner' || !record || !kind) return null

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const toggleService = (sid) =>
    setDraft((d) => {
      const next = d.selected.includes(sid)
        ? d.selected.filter((x) => x !== sid)
        : [...d.selected, sid]
      return { ...d, selected: next, manual: false }
    })

  /** Writes the chosen services back as a snapshot (id, name, price). */
  function earningSnapshot() {
    const original = data?.services || []
    return draft.selected
      .map((sid) => {
        const s = services.find((x) => x.id === sid)
        if (s) return { id: sid, name: s.name, price: Number(s.default_price || 0) }
        // A service deactivated since this earning was recorded is no longer in
        // the catalog, but it still belongs to the record — keep it verbatim
        // rather than silently dropping it from the audit trail.
        const prev = original.find((o) => o.id === sid)
        return prev ? { id: sid, name: prev.name, price: Number(prev.price || 0) } : null
      })
      .filter(Boolean)
  }

  /** Mirrors the constraints the database enforces, so the sheet can explain
   *  the problem instead of surfacing a raw 400 from PostgREST. */
  function validate() {
    if (kind === 'earning' || kind === 'payout') {
      if (!(Number(draft.amount) > 0)) return 'Enter an amount greater than zero.'
    }
    if (kind === 'payout' && draft.method === 'mpesa' && !draft.mpesaCode.trim()) {
      return 'An M-Pesa payout needs the confirmation code from the SMS.'
    }
    if (kind === 'service' && !draft.name.trim()) return 'Give the service a name.'
    if (kind === 'provider') {
      if (!draft.name.trim()) return 'A provider needs a name.'
      if (!draft.phone.trim()) return 'The phone number is how they claim their device — it cannot be empty.'
    }
    return ''
  }

  async function run() {
    setBusy(true)
    setError('')
    try {
      if (sheet === 'delete') {
        if (kind === 'earning') await deleteEarning({ localId: record.id, providerId: data.providerId })
        else if (kind === 'payout') await deletePayout({ localId: record.id, providerId: data.providerId })
        else if (kind === 'service') await deleteService(record.id)
        else if (kind === 'provider') await deleteProvider(record.id)
      } else if (kind === 'earning') {
        const snapshot = earningSnapshot()
        await updateEarning({
          localId: record.id,
          providerId: data.providerId,
          serviceId: snapshot.length === 1 ? snapshot[0].id : null,
          services: snapshot,
          amount: Number(draft.amount),
          note: draft.note.trim(),
        })
      } else if (kind === 'payout') {
        await updatePayout({
          localId: record.id,
          providerId: data.providerId,
          amount: Number(draft.amount),
          method: draft.method,
          mpesaCode: draft.method === 'mpesa' ? draft.mpesaCode.trim() : null,
          note: draft.note.trim(),
        })
      } else if (kind === 'service') {
        await updateService({
          id: record.id,
          name: draft.name.trim(),
          defaultPrice: Number(draft.defaultPrice) || null,
        })
      } else {
        await updateProvider({
          id: record.id,
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          roleTitle: draft.roleTitle.trim(),
          canSelfRecord: draft.canSelfRecord,
        })
      }
      close()
    } catch (e) {
      setError(e?.message || 'Could not save that change.')
    } finally {
      setBusy(false)
    }
  }

  const isRecord = kind === 'earning' || kind === 'payout'
  const noun = NOUN[kind] || 'Record'

  return (
    <>
      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => open('edit')} style={{ flex: 1 }}>
        Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={Trash2}
        onClick={() => open('delete')}
        style={{ flex: 1, color: status.danger.fg, borderColor: status.danger.bg }}
      >
        Delete
      </Button>

      <Sheet visible={sheet === 'edit'} onClose={close} title={`Edit ${noun.toLowerCase()}`}>
        {draft && (
          <>
            <SheetBody>
              {kind === 'earning' && (
                <>
                  {services.length > 0 && (
                    <>
                      <div style={{ ...type.metaSm, color: ink.muted, marginBottom: 6, letterSpacing: '0.02em' }}>
                        Services (pick one or more)
                      </div>
                      <ServicePicker services={services} selected={draft.selected} onToggle={toggleService} />
                    </>
                  )}
                  <Field
                    label={`Amount (KES)${!draft.manual && suggested ? ' — from selected services' : ''}`}
                    id="edit-e-amount"
                  >
                    <Input
                      id="edit-e-amount"
                      type="number"
                      inputMode="decimal"
                      value={draft.amount}
                      onChange={(e) => set({ amount: e.target.value, manual: true })}
                      placeholder="e.g. 500"
                      big
                    />
                  </Field>
                  <Field label="Note (optional)" id="edit-e-note">
                    <Input
                      id="edit-e-note"
                      value={draft.note}
                      onChange={(e) => set({ note: e.target.value })}
                      placeholder="e.g. Regular customer, tipped extra"
                      big
                    />
                  </Field>
                </>
              )}

              {kind === 'payout' && (
                <>
                  <Field label="Amount (KES)" id="edit-p-amount">
                    <Input
                      id="edit-p-amount"
                      type="number"
                      inputMode="decimal"
                      value={draft.amount}
                      onChange={(e) => set({ amount: e.target.value })}
                      placeholder="0"
                      big
                    />
                  </Field>
                  <Field label="How did you pay?" id="edit-p-method">
                    <Select
                      value={draft.method}
                      onChange={(v) => set({ method: v })}
                      options={METHODS}
                      ariaLabel="Payout method"
                    />
                  </Field>
                  {draft.method === 'mpesa' && (
                    <Field
                      label="M-Pesa confirmation code"
                      id="edit-p-code"
                      hint="Found in the M-Pesa confirmation SMS — it proves this payout reached them."
                    >
                      <Input
                        id="edit-p-code"
                        value={draft.mpesaCode}
                        onChange={(e) => set({ mpesaCode: e.target.value })}
                        placeholder="e.g. QK7X8Y9Z1"
                        autoCapitalize="characters"
                      />
                    </Field>
                  )}
                  <Field label="Note" id="edit-p-note" hint="Optional — anything worth remembering later.">
                    <Input
                      id="edit-p-note"
                      value={draft.note}
                      onChange={(e) => set({ note: e.target.value })}
                      placeholder="e.g. Paid for the whole week"
                    />
                  </Field>
                </>
              )}

              {kind === 'service' && (
                <>
                  <Field label="Service name" id="edit-s-name">
                    <Input
                      id="edit-s-name"
                      value={draft.name}
                      onChange={(e) => set({ name: e.target.value })}
                      placeholder="e.g. Haircut"
                      big
                    />
                  </Field>
                  <Field
                    label="Default price (KES)"
                    id="edit-s-price"
                    hint="Used to suggest an amount when this service is picked. Leave empty if it has no set price."
                  >
                    <Input
                      id="edit-s-price"
                      type="number"
                      inputMode="decimal"
                      value={draft.defaultPrice}
                      onChange={(e) => set({ defaultPrice: e.target.value })}
                      placeholder="0"
                      big
                    />
                  </Field>
                </>
              )}

              {kind === 'provider' && (
                <>
                  <Field label="Name" id="edit-pv-name">
                    <Input
                      id="edit-pv-name"
                      value={draft.name}
                      onChange={(e) => set({ name: e.target.value })}
                      placeholder="e.g. Brian Otieno"
                      big
                    />
                  </Field>
                  <Field
                    label="Phone number"
                    id="edit-pv-phone"
                    hint="They claim their own device with this number, so changing it means they claim again with the new one."
                  >
                    <Input
                      id="edit-pv-phone"
                      type="tel"
                      inputMode="tel"
                      value={draft.phone}
                      onChange={(e) => set({ phone: e.target.value })}
                      placeholder="07XX XXX XXX"
                      big
                    />
                  </Field>
                  <Field label="Role" id="edit-pv-role" hint="Optional — shown under their name.">
                    <Input
                      id="edit-pv-role"
                      value={draft.roleTitle}
                      onChange={(e) => set({ roleTitle: e.target.value })}
                      placeholder="e.g. Senior barber"
                    />
                  </Field>
                  <Switch
                    on={draft.canSelfRecord}
                    onToggle={() => set({ canSelfRecord: !draft.canSelfRecord })}
                    label="Let them record their own services"
                    hint={
                      draft.canSelfRecord
                        ? 'On — their records reach you for approval first.'
                        : 'Off — only you can add earnings for them.'
                    }
                  />
                </>
              )}

              <ErrorText>{error}</ErrorText>
            </SheetBody>
            <SheetFooter>
              <Button size="sm" full variant="ghost" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button
                size="sm"
                full
                disabled={busy}
                onClick={() => {
                  const problem = validate()
                  if (problem) return setError(problem)
                  run()
                }}
              >
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            </SheetFooter>
          </>
        )}
      </Sheet>

      <Sheet visible={sheet === 'delete'} onClose={close} title={`Delete this ${noun.toLowerCase()}`}>
        <SheetBody>
          <p style={{ ...type.body, color: ink.body, margin: '0 0 14px' }}>
            {isRecord
              ? `This removes ${money(data.amount)} from ${data.providerName || 'the team'}'s running totals. The record is kept until it syncs, so an accidental delete can be recovered while still offline.`
              : kind === 'service'
                ? 'The service stops being offered when adding an earning. Earnings that already used it keep the name and price they were recorded with.'
                : 'They leave the team list, and no new earnings or payouts can be recorded against them. Their existing history is kept.'}
          </p>
          <ErrorText>{error}</ErrorText>
        </SheetBody>
        <SheetFooter>
          <Button size="sm" full variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" full variant="danger" onClick={run} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
        </SheetFooter>
      </Sheet>
    </>
  )
}

/** The same switch SelfRecordToggle uses, inlined so the sheet owns its draft. */
function Switch({ on, onToggle, label, hint }) {
  return (
    <div
      style={{
        background: surface.card,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.md,
        padding: '12px 14px',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...type.body, color: ink.strong, fontWeight: 700 }}>{label}</div>
          {hint && <div style={{ ...type.metaSm, color: ink.muted, marginTop: 2 }}>{hint}</div>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          onClick={onToggle}
          style={{
            width: 50, height: 30, borderRadius: 999, border: 'none', padding: 3, flexShrink: 0,
            background: on ? brand.primary : line.hair,
            display: 'flex', alignItems: 'center',
            transition: 'background 150ms',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 24, height: 24, borderRadius: '50%', background: brand.white,
              transform: on ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 150ms',
            }}
          />
        </button>
      </div>
    </div>
  )
}
