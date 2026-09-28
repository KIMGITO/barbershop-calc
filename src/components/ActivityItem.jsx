import { useState } from 'react'
import { activityTitle, methodLabel, money, wasEdited } from '../utils/activity'

const row = { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '4px 0' }

// One audit-ready activity. Collapsed: what/who/when/how much. Tap to
// expand: the full record (services with prices, note, payment details,
// exact timestamp, reference and sync status).
export default function ActivityItem({ a, showProvider = true }) {
  const [open, setOpen] = useState(false)
  const isEarning = a.kind === 'earning'
  const accent = isEarning ? '#2FA866' : '#D9822B'
  const time = new Date(a.createdAt)
  const fromProvider = a.source === 'provider_request'
  const edited = wasEdited(a)
  const servicesTotal = a.services.reduce((s, x) => s + Number(x.price || 0), 0)

  return (
    <div
      onClick={() => setOpen(!open)}
      style={{ background: '#fff', border: '1px solid #F0EEF7', borderRadius: 16, padding: 12, marginBottom: 8 }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 16,
          background: isEarning ? '#EAF7EF' : '#FFF3E6', color: accent,
        }}>
          {isEarning ? '✂' : '↗'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activityTitle(a)}
          </div>
          <div style={{ fontSize: 12, color: '#8A8A9A' }}>
            {showProvider && a.providerName ? `${a.providerName} · ` : ''}
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {a.pending ? ' · syncing…' : ''}
            {fromProvider ? ' · self-recorded' : ''}
          </div>
        </div>
        <div style={{ fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>
          {isEarning ? '+' : '−'}{money(a.amount)}
        </div>
      </div>

      {isEarning && a.services.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {a.services.map((s, i) => (
            <span key={i} style={{ background: '#F1EBFF', color: '#6B4BE0', borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
              {s.name}{s.price ? ` · ${Number(s.price).toLocaleString()}` : ''}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #E8E5F2' }}>
          <div style={row}><span style={{ color: '#8A8A9A' }}>Type</span><span>{isEarning ? 'Earning' : 'Payout'}</span></div>
          {a.providerName && <div style={row}><span style={{ color: '#8A8A9A' }}>Provider</span><span>{a.providerName}</span></div>}
          <div style={row}><span style={{ color: '#8A8A9A' }}>Date & time</span><span>{time.toLocaleString()}</span></div>
          {isEarning && a.services.length > 0 && (
            <>
              <div style={row}><span style={{ color: '#8A8A9A' }}>Services total</span><span>{money(servicesTotal)}</span></div>
              {servicesTotal !== a.amount && (
                <div style={row}><span style={{ color: '#8A8A9A' }}>Amount adjusted</span><span>{money(a.amount - servicesTotal)}</span></div>
              )}
            </>
          )}
          {!isEarning && <div style={row}><span style={{ color: '#8A8A9A' }}>Method</span><span>{methodLabel(a.method)}</span></div>}
          {a.mpesaCode && <div style={row}><span style={{ color: '#8A8A9A' }}>M-Pesa code</span><span>{a.mpesaCode}</span></div>}
          {a.note && <div style={row}><span style={{ color: '#8A8A9A' }}>Note</span><span style={{ textAlign: 'right' }}>{a.note}</span></div>}
          {fromProvider && (
            <>
              <div style={row}><span style={{ color: '#8A8A9A' }}>Recorded by</span><span>Provider · approved by admin</span></div>
              {a.submission && (
                <div style={row}>
                  <span style={{ color: '#8A8A9A' }}>Submitted</span>
                  <span style={{ textAlign: 'right' }}>
                    {money(a.submission.amount)}
                    {(a.submission.services || []).length ? ` · ${a.submission.services.map((x) => x.name).join(', ')}` : ''}
                  </span>
                </div>
              )}
              {edited && <div style={row}><span style={{ color: '#8A8A9A' }}>Admin edits</span><span style={{ color: '#D9822B' }}>Changed before approval</span></div>}
            </>
          )}
          <div style={row}><span style={{ color: '#8A8A9A' }}>Status</span><span>{a.pending ? 'Waiting to sync' : 'Synced'}</span></div>
          <div style={row}><span style={{ color: '#8A8A9A' }}>Reference</span><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.refId}</span></div>
        </div>
      )}
    </div>
  )
}
