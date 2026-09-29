// Phone numbers are stored in one shape and matched in every shape. These
// tests are the written spec for src/utils/phone.js: the formats a Kenyan
// number gets typed in, the single canonical form they all become, what counts
// as dialable, and — the point of the exercise — that two spellings of one
// number are recognised as the same number.
import { describe, expect, it } from 'vitest'
import { formatPhone, isValidPhone, normalizePhone, samePhone } from './phone'

const CANONICAL = '+254712345678'

describe('normalizePhone', () => {
  it('stores every way a number gets typed in the same canonical shape', () => {
    const typed = [
      '0712345678', // local mobile
      '0712 345 678', // …with spaces
      '0712-345-678', // …with dashes
      '(0712) 345678',
      '712345678', // trunk 0 dropped
      '254712345678', // country code, no +
      '254 712 345 678',
      '+254712345678',
      '+254 712 345 678',
      '2540712345678', // country code with the trunk 0 left in
      '+2540712345678',
      '00254712345678', // international access code instead of +
    ]
    for (const value of typed) expect(normalizePhone(value)).toBe(CANONICAL)
  })

  it('handles the 01… mobile range the same way', () => {
    expect(normalizePhone('0112345678')).toBe('+254112345678')
    expect(normalizePhone('254112345678')).toBe('+254112345678')
    expect(normalizePhone('+254 112 345 678')).toBe('+254112345678')
  })

  it('leaves a foreign number international rather than mangling it', () => {
    expect(normalizePhone('+14155552671')).toBe('+14155552671')
    expect(normalizePhone('+255 712 345 678')).toBe('+255712345678')
    expect(normalizePhone('+441632960961')).toBe('+441632960961')
  })

  it('has no number to store when nothing dialable was given', () => {
    expect(normalizePhone('')).toBe('')
    expect(normalizePhone('   ')).toBe('')
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(undefined)).toBe('')
    expect(normalizePhone('not a number')).toBe('')
    expect(normalizePhone('+')).toBe('')
  })

  it('is idempotent — normalizing a canonical number changes nothing', () => {
    expect(normalizePhone(CANONICAL)).toBe(CANONICAL)
  })
})

describe('isValidPhone', () => {
  it('accepts a number in any format it can canonicalise', () => {
    for (const value of ['0712345678', '254712345678', '+254 712 345 678'])
      expect(isValidPhone(value)).toBe(true)
  })

  it('rejects what is not a number', () => {
    for (const value of ['', '   ', 'abc', '0712', '+', '12345'])
      expect(isValidPhone(value)).toBe(false)
  })
})

describe('samePhone', () => {
  it('sees two spellings of one number as the same number', () => {
    expect(samePhone('0712345678', '+254712345678')).toBe(true)
    expect(samePhone('0712 345 678', '254712345678')).toBe(true)
    expect(samePhone('+2540712345678', '0112345678')).toBe(false)
  })

  it('never treats an empty number as a match', () => {
    expect(samePhone('', '')).toBe(false)
    expect(samePhone(null, null)).toBe(false)
    expect(samePhone('abc', '')).toBe(false)
  })
})

describe('formatPhone', () => {
  it('shows a Kenyan number the way it is dialled', () => {
    expect(formatPhone('+254712345678')).toBe('0712 345 678')
    expect(formatPhone('254712345678')).toBe('0712 345 678')
    expect(formatPhone('+254112345678')).toBe('0112 345 678')
  })

  it('shows a foreign number as stored', () => {
    expect(formatPhone('+14155552671')).toBe('+14155552671')
  })

  it('falls back to a placeholder rather than showing nothing', () => {
    expect(formatPhone('')).toBe('—')
    expect(formatPhone(null)).toBe('—')
  })
})
