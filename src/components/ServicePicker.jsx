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
            style={{
              padding: '10px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600,
              border: on ? '2px solid #7C5CFC' : '1px solid #E0DEEB',
              background: on ? '#F1EBFF' : '#fff',
            }}
          >
            {on ? '✓ ' : ''}{s.name}{s.default_price ? ` · ${Number(s.default_price).toLocaleString()}` : ''}
          </button>
        )
      })}
    </div>
  )
}
