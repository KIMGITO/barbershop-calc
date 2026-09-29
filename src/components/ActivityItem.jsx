import { useState } from 'react';
import {
  RockingChair,
  ArrowUpRight,
  ChevronDown,
  CloudUpload,
  CircleCheck,
  Trash2,
} from 'lucide-react';
import {
  activityTitle,
  methodLabel,
  money,
  wasEdited,
} from '../utils/activity';
import {
  ink,
  line,
  surface,
  type,
  radius,
  status,
  font,
  primaryDeep,
} from '../theme';
import { IconTile, Pill } from './ui';
import RecordActions, { editableRecord } from './RecordActions';

const row = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  ...type.meta,
  padding: '4px 0',
};
const k = { color: ink.muted, flexShrink: 0 };

export default function ActivityItem({
  a,
  showProvider = true,
  isLast = false,
}) {
  const [open, setOpen] = useState(false);
  const isEarning = a.kind === 'earning';
  const accent = isEarning ? status.success.fg : status.pending.fg;
  const time = new Date(a.createdAt);
  const fromProvider = a.source === 'provider_request';
  const edited = wasEdited(a);
  // Removed by the owner, but still on the record: it is shown struck through,
  // marked as deleted, and kept out of the totals. Never dropped from the feed —
  // the history is the audit trail.
  const voided = !!a.voided;
  const servicesTotal = a.services.reduce(
    (s, x) => s + Number(x.price || 0),
    0,
  );

  return (
    <div
      style={{
        padding: '8px 6px',
        borderBottom: isLast ? 'none' : `1px solid ${line.hair}`,
        background: open ? surface.subtle : 'transparent',
        transition: 'background 150ms ease',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          textAlign: 'left',
        }}
      >
        <IconTile
          icon={isEarning ? RockingChair : ArrowUpRight}
          tone={voided ? 'muted' : isEarning ? 'wash' : 'pending'}
          size={34}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              ...type.handle,
              color: voided ? ink.muted : ink.strong,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textTransform: 'capitalize',
              textDecoration: voided ? 'line-through' : 'none',
            }}
          >
            {activityTitle(a)}
          </div>
          <div
            style={{
              ...type.tab,
              color: ink.muted,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 1,
              flexWrap: 'wrap',
              textTransform: 'uppercase',
            }}
          >
            {showProvider && a.providerName ? (
              <span>{a.providerName} · </span>
            ) : null}
            <span className="tnum">
              {time.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {a.pending && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  color: primaryDeep,
                  fontWeight: 600,
                }}
              >
                <CloudUpload size={12} strokeWidth={2.4} aria-hidden />
              </span>
            )}
            {fromProvider && <span>· self-recorded</span>}
            {voided && (
              <span style={{ color: status.danger.fg, fontWeight: 700 }}>
                · deleted
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span
            className="tnum"
            style={{
              ...type.handle,
              color: voided ? ink.muted : accent,
              whiteSpace: 'nowrap',
              textDecoration: voided ? 'line-through' : 'none',
            }}
          >
            {isEarning ? '+ ' : '− '}
            {money(a.amount)}
          </span>
          <ChevronDown
            size={15}
            color={ink.faint}
            strokeWidth={2.2}
            aria-hidden
            style={{
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 180ms ease',
            }}
          />
        </div>
      </button>

      {/* Expanded detail panel */}
      {open && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: `1px solid ${line.hair}`,
            paddingLeft: 44,
          }}
        >
          <div style={row}>
            <span style={k}>Type</span>
            <span  >{isEarning ? 'Earning' : 'Payout'}</span>
          </div>
          {a.providerName && (
            <div style={row}>
              <span style={k}>Provider</span>
              <span style={{textTransform:'capitalize'}}>{a.providerName}</span>
            </div>
          )}
          <div style={row}>
            <span style={k}>Date & time</span>
            <span className="tnum">{time.toLocaleString()}</span>
          </div>
          {isEarning && a.services.length > 0 && (
            <>
              <div style={row}>
                <span style={k}>Services</span>
                <span style={{ textAlign: 'right' }}>
                  {a.services
                    .map(
                      (s) =>
                        `${s.name} (${Number(s.price || 0).toLocaleString()})`,
                    )
                    .join(', ')}
                </span>
              </div>
              <div style={row}>
                <span style={k}>Services total</span>
                <span className="tnum">{money(servicesTotal)}</span>
              </div>
              {servicesTotal !== a.amount && (
                <div style={row}>
                  <span style={k}>Amount adjusted</span>
                  <span className="tnum">
                    {money(a.amount - servicesTotal)}
                  </span>
                </div>
              )}
            </>
          )}
          {!isEarning && (
            <div style={row}>
              <span style={k}>Method</span>
              <span>{methodLabel(a.method)}</span>
            </div>
          )}
          {a.mpesaCode && (
            <div style={row}>
              <span style={k}>M-Pesa code</span>
              <span style={{ fontFamily: font.mono, ...type.meta }}>
                {a.mpesaCode}
              </span>
            </div>
          )}
          {a.note && (
            <div style={row}>
              <span style={k}>Note</span>
              <span style={{ textAlign: 'right' }}>{a.note}</span>
            </div>
          )}
          {fromProvider && (
            <>
              <div style={row}>
                <span style={k}>Recorded by</span>
                <span>Provider · approved by admin</span>
              </div>
              {edited && (
                <div style={row}>
                  <span style={k}>Admin edits</span>
                  <span style={{ color: status.pending.fg }}>
                    Changed before approval
                  </span>
                </div>
              )}
            </>
          )}
          {voided && (
            <div style={row}>
              <span style={k}>Deleted</span>
              <span className="tnum">
                {a.voidedAt ? new Date(a.voidedAt).toLocaleString() : 'Yes'}
              </span>
            </div>
          )}
          <div style={row}>
            <span style={k}>Status</span>
            {voided ? (
              <Pill tone="danger" icon={Trash2}>
                Deleted
              </Pill>
            ) : a.pending ? (
              <Pill tone="info" icon={CloudUpload}>
                Waiting to sync
              </Pill>
            ) : (
              <Pill tone="success" icon={CircleCheck}>
                Synced
              </Pill>
            )}
          </div>
        

          {/* Nothing left to edit or remove on a deleted record: the one thing a
              second "delete" could do is erase it, and the history is permanent. */}
          {!voided && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <RecordActions record={editableRecord(a)} data={a} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
