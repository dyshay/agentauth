import * as jose from 'jose'
import type { AgentCapabilityScore } from './types.js'

export interface AgentAuthJWTPayload extends jose.JWTPayload {
  capabilities: AgentCapabilityScore
  model_family: string
  challenge_ids: string[]
  agentauth_version: string
}

export interface SignOptions {
  ttlSeconds?: number
}

export interface TokenSignInput {
  sub: string
  capabilities: AgentCapabilityScore
  model_family: string
  challenge_ids: string[]
}

export class TokenManager {
  private secret: Uint8Array

  constructor(secret: string) {
    this.secret = new TextEncoder().encode(secret)
  }

  async sign(input: TokenSignInput, options?: SignOptions): Promise<string> {
    const ttl = options?.ttlSeconds ?? 3600

    return new jose.SignJWT({
      capabilities: input.capabilities,
      model_family: input.model_family,
      challenge_ids: input.challenge_ids,
      agentauth_version: '1',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(input.sub)
      .setIssuer('agentauth')
      .setIssuedAt()
      .setExpirationTime(`${ttl}s`)
      .setJti(crypto.randomUUID())
      .sign(this.secret)
  }

  async verify(token: string): Promise<AgentAuthJWTPayload> {
    const { payload } = await jose.jwtVerify(token, this.secret, {
      issuer: 'agentauth',
    })
    return payload as AgentAuthJWTPayload
  }

  decode(token: string): AgentAuthJWTPayload {
    const payload = jose.decodeJwt(token)
    return payload as AgentAuthJWTPayload
  }
}
