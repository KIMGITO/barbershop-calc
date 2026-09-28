import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { brand, ink, line, surface, type, radius, shadow } from '../theme'

/**
 * The app's own dropdown, in place of a native <select>.
 *
 * A native select renders the OS menu, which ignores the brand entirely — it
 * came out grey-on-white on Android and iOS alike. This is a styled
 * button + popover list instead.
 *
 * Accessibility: a real listbox. Arrow keys / Home / End move the highlight,
 * Enter or Space commit, Escape closes, and the highlighted option is
 * announced via aria-activedescendant. Focus returns to the trigger on close.
 * The popover is portalled to <body> so it is never clipped by a scrolling
 * or `overflow:hidden` ancestor, and it flips upward when there isn't room
 * below.
 */
// The popover's own geometry. Kept as module constants so the measuring code
// and the panel agree on them without magic numbers in two places.
const GAP = 6      // breathing room between trigger and panel
const EDGE = 8     // keep this much viewport clear on every side
const PANEL_MAX = 280

export default function Select({
  value,
  onChange,
  options = [],    // [{ value, label, hint? }]
  placeholder = 'Select…',
  disabled = false,
  ariaLabel,
  icon: Icon,       // optional leading lucide icon
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Trigger box for the panel. `vh` is captured with it so the render path
  // never has to reach for `window` (and can't see a stale viewport height).
  const [rect, setRect] = useState(null)
  const [drop, setDrop] = useState('down')  // 'down' | 'up'
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)

  // Start the highlight on the current value, so Enter re-commits it.
  // Keyed on the values rather than the `options` array itself: callers build
  // it inline (`options={[...]}`), so the identity changes every render and
  // keying on it would reset the highlight mid keyboard-navigation.
  // \x1f (unit separator) joins the key so two different value lists can't
  // collide into the same string.
  const optionKey = options.map((o) => o.value).join('\x1f')
  useEffect(() => {
    if (open) setActive(options.findIndex((o) => o.value === value))
  }, [open, value, optionKey])  // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click / Escape, and restore focus to the trigger.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (listRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); triggerRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const commit = (opt) => {
    onChange(opt.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onKeyDown = (e) => {
    if (disabled) return
    // Open on Enter/Space/ArrowDown when closed.
    if (!open && ['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault()
      toggle(true)
      return
    }
    if (!open) return
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); break
      case 'ArrowUp':   e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); break
      case 'Home':      e.preventDefault(); setActive(0); break
      case 'End':       e.preventDefault(); setActive(options.length - 1); break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (options[active]) commit(options[active])
        break
      case 'Tab':       setOpen(false); break
      default: break
    }
  }

  // The trigger is the panel's anchor. Measured on open, and re-measured while
  // open (scroll, rotate, on-screen keyboard) so the panel never detaches from
  // the button it belongs to. Returns false when there is nothing to measure.
  const measure = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r || !r.width) return false
    const vh = window.innerHeight
    // A trigger flush against the right edge would push the panel off-screen,
    // so clamp its left edge into the viewport. It still lines up flush with
    // the trigger's own left edge whenever there is room for it to.
    const left = Math.min(
      Math.max(EDGE, r.left),
      Math.max(EDGE, window.innerWidth - r.width - EDGE),
    )
    // Never wider than the viewport either, for a trigger that is itself wider
    // than the screen (very narrow phone, or mid on-screen-keyboard animation).
    const width = Math.min(r.width, Math.max(0, window.innerWidth - EDGE * 2))
    setRect({ top: r.top, bottom: r.bottom, left, width, vh })
    const below = vh - r.bottom
    setDrop(below < PANEL_MAX && r.top > below ? 'up' : 'down')
    return true
  }

  const toggle = (force) => {
    if (disabled) return
    const next = force ?? !open
    if (!next) { setOpen(false); return }
    // Only open once the anchor is known. Opening with no measured rect is
    // what left `rect` null and blew up the moment anything read it.
    if (measure()) setOpen(true)
  }

  // Follow the trigger while the panel is open. Capture phase, so scrolling
  // any ancestor moves the panel too; rAF-throttled, so it costs at most one
  // measure per frame; and torn down with the effect.
  useEffect(() => {
    if (!open) return
    let ticking = false
    const onMove = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => { ticking = false; measure() })
    }
    window.addEventListener('scroll', onMove, { passive: true, capture: true })
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])  // eslint-disable-line react-hooks/exhaustive-deps

  // Built lazily, and only ever called once `rect` is known to exist — never
  // eagerly at the top of the component, where a null `rect` was dereferenced
  // on the very first render, before the `{open && rect && ...}` guard below
  // had a chance to run.
  const renderPanel = () => {
    const room = drop === 'down'
      ? rect.vh - rect.bottom - GAP - EDGE
      : rect.top - GAP - EDGE
    return (
    <div
      ref={listRef}
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={-1}
      style={{
        position: 'fixed',
        ...(drop === 'down'
          ? { top: rect.bottom + GAP, left: rect.left, width: rect.width }
          : { bottom: rect.vh - rect.top + GAP, left: rect.left, width: rect.width }),
        // Never taller than the room actually left, so it can't run off the
        // screen on a short viewport (landscape, small phone, keyboard up).
        maxHeight: Math.max(132, Math.min(PANEL_MAX, room)),
        background: surface.card,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.lg,
        boxShadow: shadow.pop,
        padding: 6,
        zIndex: 1000,
        maxHeight: 280,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {options.map((o, i) => {
        const isSel = o.value === value
        const isActive = i === active
        return (
          <div
            key={o.value}
            id={`${listId}-opt-${i}`}
            role="option"
            aria-selected={isSel}
            // onMouseDown (not onClick) with preventDefault: this commits on
            // press, and the preventDefault stops the trigger losing focus
            // out from under the keyboard handler.
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => { e.preventDefault(); commit(o) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: radius.md,
              ...type.body,
              color: isSel ? brand.primary : ink.body,
              background: isActive ? surface.wash : 'transparent',
              fontWeight: isSel ? 700 : 400,
              cursor: 'pointer',
              minHeight: 44,                       // comfortable touch target
            }}
          >
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {o.label}
            </span>
            {o.hint && <span style={{ ...type.metaSm, color: ink.muted, flexShrink: 0 }}>{o.hint}</span>}
            {isSel && <Check size={16} color={brand.primary} strokeWidth={3} aria-hidden />}
          </div>
        )
      })}
    </div>
    )
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => toggle()}
        onKeyDown={onKeyDown}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', minHeight: 46,
          background: open ? surface.wash : surface.card,
          border: `1px solid ${open ? brand.primary : line.hair}`,
          borderRadius: radius.md,
          color: selected ? ink.strong : ink.faint,
          ...type.body,
          textAlign: 'left',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {Icon && (
          <Icon size={17} color={ink.muted} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={18}
          color={ink.muted}
          strokeWidth={2.25}
          aria-hidden
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease',
            flexShrink: 0,
          }}
        />
      </button>
      {open && rect && createPortal(renderPanel(), document.body)}
    </>
  )
}
