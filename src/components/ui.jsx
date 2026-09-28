import { brand, ink, line, surface, type, radius, shadow, status, primaryDeep } from '../theme'

/**
 * Shared building blocks. Screens compose these instead of hand-writing
 * inline styles, which is what keeps the brand consistent across the app.
 */

export const Screen = ({ children, style, ...rest }) => (
  <div style={{ padding: 16, paddingBottom: 110, ...style }} {...rest}>{children}</div>
)

export function Card({ children, style, ...rest }) {
  return (
    <div
      style={{
        background: surface.card,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.lg,
        padding: 14,
        boxShadow: shadow.card,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

/** Primary / soft / ghost / danger button. */
export function Button({
  children, variant = 'primary', size = 'md', icon: Icon, full, style, ...rest
}) {
  const h = size === 'sm' ? 36 : 46
  const variants = {
    primary: { bg: primaryDeep, fg: brand.white, border: primaryDeep },
    accent:  { bg: brand.accent, fg: brand.white, border: brand.accent },
    soft:    { bg: surface.wash,  fg: primaryDeep, border: 'transparent' },
    ghost:   { bg: 'transparent', fg: ink.soft,    border: line.hair },
    danger:  { bg: status.danger.solid, fg: brand.white, border: status.danger.solid },
  }
  const v = variants[variant] || variants.primary
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        minHeight: h, padding: size === 'sm' ? '0 12px' : '0 18px',
        width: full ? '100%' : undefined,
        background: v.bg, color: v.fg,
        border: `1px solid ${v.border}`,
        borderRadius: radius.md,
        ...(size === 'sm' ? type.meta : type.body),
        fontWeight: 700,
        ...style,
      }}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 15 : 17} strokeWidth={2.4} aria-hidden />}
      {children}
    </button>
  )
}

/** Section heading, with an optional trailing action. */
export function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '22px 0 10px' }}>
      <div style={{ ...type.section, color: ink.strong }}>{children}</div>
      {action}
    </div>
  )
}

export function Label({ children, htmlFor, style }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{ display: 'block', ...type.metaSm, color: ink.muted, marginBottom: 6, letterSpacing: '0.02em', ...style }}
    >
      {children}
    </label>
  )
}

export function Field({ label, id, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {children}
      {hint && <div style={{ ...type.metaSm, color: ink.muted, marginTop: 6 }}>{hint}</div>}
    </div>
  )
}

/** Text/number input in the brand style. */
export function Input({ style, big, ...rest }) {
  return (
    <input
      style={{
        width: '100%', padding: big ? '14px' : '12px 14px',
        minHeight: big ? 50 : 46,
        borderRadius: radius.md,
        border: `1px solid ${line.hair}`,
        background: surface.subtle,
        color: ink.strong,
        ...type.body,
        ...style,
      }}
      {...rest}
    />
  )
}

/** Small status pill. `tone` is a key of `status`. */
export function Pill({ children, tone = 'neutral', icon: Icon, style }) {
  const s = status[tone] || status.neutral
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: s.bg, color: s.fg,
        borderRadius: radius.pill,
        padding: '3px 9px',
        ...type.metaSm, fontWeight: 700,
        ...style,
      }}
    >
      {Icon && <Icon size={12} strokeWidth={2.75} aria-hidden />}
      {children}
    </span>
  )
}

/** Neutral selectable chip (service picker, filter rows). */
export function Chip({ active, children, onClick, style, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      style={{
        padding: '9px 14px', borderRadius: radius.pill,
        ...type.meta, fontWeight: active ? 700 : 500,
        border: `1px solid ${active ? brand.primary : line.hair}`,
        background: active ? brand.primary : surface.card,
        color: active ? brand.white : ink.soft,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Square icon tile used in list rows. */
export function IconTile({ icon: Icon, tone = 'wash', size = 40, style }) {
  const tones = {
    wash:    { bg: surface.wash,       fg: primaryDeep },
    accent:  { bg: brand.accent,      fg: ink.strong },
    success: { bg: status.success.bg, fg: status.success.fg },
    pending: { bg: status.pending.bg, fg: status.pending.fg },
    danger:  { bg: status.danger.bg,  fg: status.danger.fg },
    muted:   { bg: surface.subtle,    fg: ink.muted },
  }
  const t = tones[tone] || tones.wash
  return (
    <div
      aria-hidden
      style={{
        width: size, height: size, borderRadius: radius.md,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: t.bg, color: t.fg, flexShrink: 0,
        ...style,
      }}
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={2.3} />
    </div>
  )
}

/** Round icon-only button (back arrows, close). */
export function IconButton({ icon: Icon, label, tone = 'card', size = 40, style, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={{
        width: size, height: size, borderRadius: radius.pill,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: tone === 'card' ? surface.card : 'transparent',
        color: tone === 'card' ? primaryDeep : ink.soft,
        border: `1px solid ${line.hair}`,
        boxShadow: tone === 'card' ? shadow.card : 'none',
        flexShrink: 0,
        ...style,
      }}
      {...rest}
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={2.4} aria-hidden />
    </button>
  )
}

export function EmptyState({ icon: Icon, children, style }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        padding: '36px 16px', textAlign: 'center', ...style,
      }}
    >
      {Icon && (
        <div
          aria-hidden
          style={{
            width: 48, height: 48, borderRadius: radius.pill,
            background: surface.wash, color: primaryDeep,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon size={22} strokeWidth={2} />
        </div>
      )}
      <div style={{ ...type.comment, color: ink.muted, maxWidth: 280 }}>{children}</div>
    </div>
  )
}

export function ErrorText({ children, style }) {
  if (!children) return null
  return (
    <div
      role="alert"
      style={{
        ...type.meta, color: status.danger.fg, marginBottom: 12,
        background: status.danger.bg, padding: '9px 12px',
        borderRadius: radius.sm, ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Money, always tabular so columns of figures line up. */
export function Money({ children, style }) {
  return <span className="tnum" style={{ ...type.amount, color: ink.strong, ...style }}>{children}</span>
}

