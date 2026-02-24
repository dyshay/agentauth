import { webcrypto } from 'node:crypto'

const subtle = webcrypto.subtle

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  webcrypto.getRandomValues(bytes)
  return bytes
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(hash))
}

export async function hmacSha256Hex(
  message: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder()
  const key = await subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await subtle.sign('HMAC', key, encoder.encode(message))
  return toHex(new Uint8Array(signature))
}

export function generateId(): string {
  return `ch_${toHex(randomBytes(16))}`
}

export function generateSessionToken(): string {
  return `st_${toHex(randomBytes(24))}`
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)
  let result = 0
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i]
  }
  return result === 0
}
