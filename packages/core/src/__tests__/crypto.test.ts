import { describe, it, expect } from 'vitest'
import {
  randomBytes,
  toHex,
  fromHex,
  sha256Hex,
  hmacSha256Hex,
  generateId,
  generateSessionToken,
  timingSafeEqual,
} from '../crypto.js'

describe('randomBytes', () => {
  it('returns a Uint8Array of requested length', () => {
    const bytes = randomBytes(32)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBe(32)
  })

  it('returns different bytes each call', () => {
    const a = randomBytes(16)
    const b = randomBytes(16)
    expect(toHex(a)).not.toBe(toHex(b))
  })
})

describe('toHex / fromHex', () => {
  it('round-trips correctly', () => {
    const bytes = new Uint8Array([0x00, 0xff, 0xa3, 0x42])
    expect(toHex(bytes)).toBe('00ffa342')
    expect(fromHex('00ffa342')).toEqual(bytes)
  })

  it('handles empty input', () => {
    expect(toHex(new Uint8Array([]))).toBe('')
    expect(fromHex('')).toEqual(new Uint8Array([]))
  })
})

describe('sha256Hex', () => {
  it('hashes known input correctly', async () => {
    // SHA-256 of empty string
    const hash = await sha256Hex(new Uint8Array([]))
    expect(hash).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('hashes "hello" correctly', async () => {
    const input = new TextEncoder().encode('hello')
    const hash = await sha256Hex(input)
    expect(hash).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    )
  })
})

describe('hmacSha256Hex', () => {
  it('computes HMAC correctly', async () => {
    const hmac = await hmacSha256Hex('message', 'secret')
    expect(hmac).toMatch(/^[a-f0-9]{64}$/)
  })

  it('different keys produce different HMACs', async () => {
    const a = await hmacSha256Hex('message', 'key1')
    const b = await hmacSha256Hex('message', 'key2')
    expect(a).not.toBe(b)
  })

  it('different messages produce different HMACs', async () => {
    const a = await hmacSha256Hex('msg1', 'key')
    const b = await hmacSha256Hex('msg2', 'key')
    expect(a).not.toBe(b)
  })
})

describe('generateId', () => {
  it('returns a string with ch_ prefix', () => {
    const id = generateId()
    expect(id).toMatch(/^ch_[a-f0-9]+$/)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })
})

describe('generateSessionToken', () => {
  it('returns a string with st_ prefix', () => {
    const token = generateSessionToken()
    expect(token).toMatch(/^st_[a-f0-9]+$/)
  })
})

describe('timingSafeEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
  })

  it('returns false for different strings', () => {
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
  })

  it('returns false for different lengths', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
  })
})
