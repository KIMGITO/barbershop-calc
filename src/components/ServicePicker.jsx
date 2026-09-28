import { Check } from 'lucide-react'
import { brand, ink, line, surface, type, radius, primaryDeep } from '../theme'

// Multi-select service chips. `services` = [{ id, name, default_price }].
export default function ServicePicker({ services, selected, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0 16px' }}>
      {services.map((s) => {
        const on = selected.includes(s.id)
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onToggle(s.id)}
            aria-pressed={on}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 14px', borderRadius: radius.md,
              ...type.comment, fontWeight: on ? 700 : 500,
              border: `1px solid ${on ? brand.primary : line.hair}`,
              background: on ? surface.wash : surface.card,
              color: on ? primaryDeep : ink.soft,
            }}
          >
            {/* A tick box, not a tick character: it reads as a control. */}
            {on && <Check size={15} strokeWidth={3} aria-hidden />}
            {s.name}
            {s.default_price ? <span className="tnum" style={{ ...type.meta, color: ink.muted }}>· {Number(s.default_price).toLocaleString()}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
