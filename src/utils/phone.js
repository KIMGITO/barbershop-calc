// One phone number, one shape — however it was typed.
//
// A Kenyan number gets written at least four ways: 0712345678, 0112345678,
// 254712345678, +254 712 345 678. They are the same number. If each were
// stored as typed, the same provider could be registered twice (once as
// "254712345678" and once as "0712345678"), a claim would miss the row the
// owner created, and "unique per shop" would mean nothing.
//
// So every number the app writes goes through normalizePhone() and is stored
// in one canonical E.164 shape, and every lookup normalizes the typed value
// the same way. Registration is unique after normalizing: the local pre-check
// in useShopStore and the database's `unique (shop_id, phone)` constraint
// both compare the canonical form (see supabase/migrations/0011_*).
//
// The numbers this understands are Kenyan (the market the app is built for):
//
//   +254712345678 / 254712345678 / 2540712345678  → +254712345678
//   0712345678 / 0112345678 / 0712 345 678        → +254712345678
//   712345678 (the trunk 0 dropped)                → +254712345678
//   00254712345678 (the 00 access code)            → +254712345678
//
// Anything else keeps its digits, only marked as international, so a foreign
// number (+14155552671) is stored and compared consistently instead of being
// mangled into a Kenyan one.

const KE_COUNTRY_CODE = '254'

/**
 * Canonical form of a phone number: `+254712345678` (E.164).
 * Unrecognisable input keeps its digits behind a `+`; no digits at all is ''.
 */
export function normalizePhone(raw) {
  let digits = String(raw ?? '').replace(/[^0-9]/g, '')
  if (!digits) return ''

  // 00254712345678 — the international access code some diallers write
  // instead of "+". Nothing local starts with 00, so it is always a prefix.
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!digits) return ''

  // +254 0712 345 678 — the trunk 0 left in after the country code.
  if (digits.length === 13 && digits.startsWith(`${KE_COUNTRY_CODE}0`)) {
    return `+${KE_COUNTRY_CODE}${digits.slice(4)}`
  }
  // 254712345678 / +254712345678 — country code, trunk 0 already dropped.
  if (digits.length === 12 && digits.startsWith(KE_COUNTRY_CODE)) {
    return `+${digits}`
  }
  // 0712345678 / 0112345678 — the local form, leading 0.
  if (digits.length === 10 && digits.startsWith('0')) {
    return `+${KE_COUNTRY_CODE}${digits.slice(1)}`
  }
  // 712345678 — local, 0 dropped. Kenyan mobiles start 7 or 1, so a 9-digit
  // number starting with anything else is left alone rather than guessed at.
  if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) {
    return `+${KE_COUNTRY_CODE}${digits}`
  }

  return `+${digits}`
}

/**
 * True when a value is a phone number the app is willing to register or claim
 * with: a `+` and 9–15 digits, which is E.164's own range.
 */
export function isValidPhone(raw) {
  return /^\+[0-9]{9,15}$/.test(normalizePhone(raw))
}

/**
 * Do two values mean the same number? Compared in canonical form, so
 * "0712 345 678" and "+254712345678" match. Two empty values do not.
 */
export function samePhone(a, b) {
  const left = normalizePhone(a)
  return !!left && left === normalizePhone(b)
}

/**
 * Local display form — `0712 345 678` — for the screens that show a number
 * back to the owner. Anything that isn't a Kenyan mobile is shown canonical,
 * and an empty number shows as an em dash so no label ends in a dangling "·".
 */
export function formatPhone(raw) {
  const phone = normalizePhone(raw)
  if (!phone) return '—'
  const ke = phone.match(/^\+254([71][0-9]{8})$/)
  if (!ke) return phone
  const local = ke[1]
  return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
}
