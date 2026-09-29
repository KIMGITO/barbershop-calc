import { ink, line, surface, type, radius } from '../theme';

export default function StatPill({ label, value, accent, big = false }) {
  return (
    <div
      style={{
        ...type.metaSm,
        color: ink.strong,
        background: big ? 'var(--gradient-primary)' : surface.card,
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${line.hair}`,
        borderRadius: radius.md,
        padding: '8px 10px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          ...(big ? type.amount : type.metaSm),
          color: ink.muted,
          marginBottom: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div
        className="tnum"
        style={{
          ...(big ? type.display : type.handle),
          color: accent || ink.strong,
          whiteSpace: 'nowrap',
        }}
      >
        KES {Number(value || 0).toLocaleString()}
      </div>
    </div>
  );
}
