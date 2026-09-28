/**
 * Brand theme — the single source of truth for shared styles, and the ONLY
 * place components are allowed to get a colour from.
 *
 * Every colour value below is a reference to a CSS custom property. The raw
 * values live in one place: the :root blocks of src/index.css. Nothing in
 * this file — or in any component/page — contains a colour literal, so
 * re-theming the app means editing that CSS block only.
 *
 * Contrast note: text steps (`ink`) are derived from --foreground at
 * descending opacity; status pairs clear WCAG AA on both --background and
 * --surface (see the Design section of the README).
 */

/* ---------- 1. Brand palette ---------- */
export const brand = {
  white:   'var(--primary-foreground)', // text/rings on saturated fills
  tint:    'var(--background)',         // page ground
  mid:     'var(--border)',             // fills, borders, dividers
  accent:  'var(--accent)',             // highlights, icons, active states
  primary: 'var(--primary)',            // links, active text, primary chrome
}

/* ---------- 2. Text ---------- */
// Cream steps over the black ground: full strength for headings, then
// --ink-soft / --ink-muted / --ink-faint (derived in index.css) for
// progressively quieter copy — timestamps, labels, placeholders.
export const ink = {
  strong: 'var(--foreground)',    // headings, money figures
  body:   'var(--surface-foreground)', // paragraph copy (mostly on cards)
  soft:   'var(--ink-soft)',      // secondary copy
  muted:  'var(--ink-muted)',     // timestamps, field labels
  faint:  'var(--ink-faint)',     // disabled / placeholder only — never body copy
  onDark: 'var(--muted-foreground)', // solid white on dark/coloured fills
}

// The one orange used for links, active text and solid fills. The palette
// has a single cut of the brand hue, so this aliases --primary.
export const primaryDeep = 'var(--primary)'

/* ---------- 3. Surfaces ---------- */
export const surface = {
  page:   'var(--background)',       // app background (black)
  card:   'var(--surface)',          // panels, cards (#262626)
  subtle: 'var(--surface-subtle)',   // inputs, inner panels, wells
  wash:   'var(--wash)',             // active pill / selected chip (warm tint)
  nav:    'var(--surface)',          // bottom tab bar
}

/* ---------- 4. Lines & depth ---------- */
export const line = {
  hair: 'var(--border)',        // default border
  soft: 'var(--border)',        // internal dividers
  dash: 'var(--border-strong)', // dashed rules inside same-colour cards
}

/* ---------- 5. Status ----------
 * Success/pending/rejected stay semantically distinct (green/amber/red) for
 * the approvals inbox. Each tone offers three roles:
 *   fg    — text/icon on --background or --surface (AA on both)
 *   bg    — translucent chip fill, composites over page or card
 *   solid — filled element carrying --primary-foreground text
 */
export const status = {
  success: { fg: 'var(--success)',   bg: 'var(--success-bg)',   solid: 'var(--success-solid)' },
  pending: { fg: 'var(--pending)',   bg: 'var(--pending-bg)',   solid: 'var(--pending-solid)' },
  danger:  { fg: 'var(--danger)',    bg: 'var(--danger-bg)',    solid: 'var(--danger-solid)' },
  info:    { fg: 'var(--primary)',   bg: 'var(--info-bg)',      solid: 'var(--primary)' },
  neutral: { fg: 'var(--ink-muted)', bg: 'var(--surface-subtle)', solid: 'var(--border-strong)' },
}

/* ---------- 6. Type ----------
 * Sizes follow the "Element Type Baseline" of the brand guide. The guide is
 * written for a social feed, so each role is mapped to the equivalent part of
 * this app (see README > Design > type).
 */
export const font = {
  family: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', // ref codes
}

export const type = {
  // The brand guide puts hook titles at 95–160px. That is a hero size: it is
  // used on the two welcome screens, where there is no data competing with it.
  // 24vw hits ~96px on a 400px phone; the upper clamp stops it at 160px on
  // tablets/desktop so it can't dominate a wide window.
  hook:    { fontSize: 'clamp(96px, 24vw, 160px)', fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.03em' },
  display: { fontSize: 30, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em' },
  screen:  { fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' },
  section: { fontSize: 16, fontWeight: 700 },
  amount:  { fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' },
  // A person's name set as a title (profile header, greeting on the hero
  // card) — one step above the 14px handle. Same optical size as `amount`,
  // but named for its job so screens never reach for a raw 17/18px.
  name:    { fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' },
  handle:  { fontSize: 14, fontWeight: 700 }, // 14px bold — names, nav handles
  body:    { fontSize: 14, fontWeight: 400 }, // 14px regular — feed body
  comment: { fontSize: 13, fontWeight: 400 }, // 13px — secondary sections
  meta:    { fontSize: 12, fontWeight: 400 }, // 12px — timestamps
  metaSm:  { fontSize: 11, fontWeight: 500 }, // 11px — tightest metadata
  tab:     { fontSize: 10, fontWeight: 500, letterSpacing: '0.01em' },
}

/* ---------- 7. Shape ---------- */
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 }

/* Depth. Shadows are --background (black) at low alpha — they only read
 * under panels that are lighter than the page, e.g. cards on the page. */
export const shadow = {
  card:   'var(--shadow-card)',
  nav:    'var(--shadow-nav)',
  pop:    'var(--shadow-pop)',
  glow:   'var(--shadow-glow)',   // warm halo under the balance hero
  header: 'var(--shadow-header)', // sticky-header fade over scrolling feed
}
