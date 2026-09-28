import { useState } from 'react'
import { Scissors, ArrowUpRight, ChevronDown, CloudUpload, CircleCheck } from 'lucide-react'
import { activityTitle, methodLabel, money, wasEdited } from '../utils/activity'
import { ink, line, shadow, surface, type, radius, status, font, primaryDeep } from '../theme'
import { IconTile, Pill } from './ui'

const row = { display: 'flex', justifyContent: 'space-between', gap: 12, ...type.meta, padding: '4px 0' }
const k = { color: ink.muted, flexShrink: 0 }

// One audit-ready activity. Collapsed: what/who/when/how much. Tap to
// expand: the full record (services with prices, note, payment details,
// exact timestamp, reference and sync status).
export default function ActivityItem({ a, showProvider = true }) {
  const [open, setOpen] = useState(false)
  const isEarning = a.kind === 'earning'
  const accent = isEarning ? status.success.fg : status.pending.fg
  const time = new Date(a.createdAt)
  const fromProvider = a.source === 'provider_request'
  const edited = wasEdited(a)
  const servicesTotal = a.services.reduce((s, x) => s + Number(x.price || 0), 0)

  return (
    <div
      style={{
        background: surface.card,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.lg,
        padding: 12,
        marginBottom: 8,
        boxShadow: shadow.card,
      }}
    >
      {/* The whole collapsed row is the button: bigger touch target, and it
          announces its expanded state to a screen reader. */}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
      >
        <IconTile icon={isEarning ? Scissors : ArrowUpRight} tone={isEarning ? 'success' : 'pending'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...type.handle, color: ink.strong, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activityTitle(a)}
          </div>
          <div style={{ ...type.meta, color: ink.muted, display: 'flex', alignItems: 'center', gap: 5, marginTop: 1, flexWrap: 'wrap' }}>
            {showProvider && a.providerName ? <span>{a.providerName} · </span> : null}
            <span className="tnum">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {a.pending && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: primaryDeep, fontWeight: 600 }}>
                <CloudUpload size={12} strokeWidth={2.4} aria-hidden /> syncing…
              </span>
            )}
            {fromProvider && <span>· self-recorded</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span className="tnum" style={{ ...type.amount, color: accent, whiteSpace: 'nowrap' }}>
            {isEarning ? '+' : '−'}{money(a.amount)}
          </span>
          <ChevronDown
            size={16}
            color={ink.faint}
            strokeWidth={2.4}
            aria-hidden
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}
          />
        </div>
      </button>

      {isEarning && a.services.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {a.services.map((s, i) => (
            <span key={i} style={{ background: surface.wash, color: primaryDeep, borderRadius: radius.sm, padding: '3px 8px', ...type.metaSm, fontWeight: 600 }}>
              {s.name}{s.price ? ` · ${Number(s.price).toLocaleString()}` : ''}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${line.dash}` }}>
          <div style={row}><span style={k}>Type</span><span>{isEarning ? 'Earning' : 'Payout'}</span></div>
          {a.providerName && <div style={row}><span style={k}>Provider</span><span>{a.providerName}</span></div>}
          <div style={row}><span style={k}>Date & time</span><span className="tnum">{time.toLocaleString()}</span></div>
          {isEarning && a.services.length > 0 && (
            <>
              <div style={row}><span style={k}>Services total</span><span className="tnum">{money(servicesTotal)}</span></div>
              {servicesTotal !== a.amount && (
                <div style={row}><span style={k}>Amount adjusted</span><span className="tnum">{money(a.amount - servicesTotal)}</span></div>
              )}
            </>
          )}
          {!isEarning && <div style={row}><span style={k}>Method</span><span>{methodLabel(a.method)}</span></div>}
          {a.mpesaCode && <div style={row}><span style={k}>M-Pesa code</span><span style={{ fontFamily: font.mono, ...type.meta }}>{a.mpesaCode}</span></div>}
          {a.note && <div style={row}><span style={k}>Note</span><span style={{ textAlign: 'right' }}>{a.note}</span></div>}
          {fromProvider && (
            <>
              <div style={row}><span style={k}>Recorded by</span><span>Provider · approved by admin</span></div>
              {a.submission && (
                <div style={row}>
                  <span style={k}>Submitted</span>
                  <span style={{ textAlign: 'right' }}>
                    {money(a.submission.amount)}
                    {(a.submission.services || []).length ? ` · ${a.submission.services.map((x) => x.name).join(', ')}` : ''}
                  </span>
                </div>
              )}
              {edited && <div style={row}><span style={k}>Admin edits</span><span style={{ color: status.pending.fg }}>Changed before approval</span></div>}
            </>
          )}
          <div style={row}>
            <span style={k}>Status</span>
            {a.pending
              ? <Pill tone="info" icon={CloudUpload}>Waiting to sync</Pill>
              : <Pill tone="success" icon={CircleCheck}>Synced</Pill>}
          </div>
          <div style={row}>
            <span style={k}>Reference</span>
            <span style={{ fontFamily: font.mono, ...type.metaSm, color: ink.soft }}>{a.refId}</span>
          </div>
        </div>
      )}
    </div>
  )
}
