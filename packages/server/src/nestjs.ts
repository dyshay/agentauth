import {
  AgentAuthEngine,
  buildHeaders,
  type AgentAuthConfig,
  type InitChallengeOptions,
  type SolveInput,
  type VerifyTokenResult,
  type InitChallengeResult,
} from '@xagentauth/core'

// ---------------------------------------------------------------------------
// Minimal NestJS-compatible types.
// Using these instead of importing @nestjs/common keeps it as an optional
// peer dependency — the same pattern used by the Hono adapter.
// ---------------------------------------------------------------------------

interface NestRequest {
  headers: Record<string, string | string[] | undefined>
  params: Record<string, string>
  body: Record<string, unknown>
}

interface NestResponse {
  status(code: number): NestResponse
  json(data: unknown): void
  setHeader(name: string, value: string): NestResponse
}

interface ArgumentsHost {
  switchToHttp(): {
    getRequest<T = NestRequest>(): T
    getResponse<T = NestResponse>(): T
  }
}

interface ExecutionContext extends ArgumentsHost {
  getHandler(): (...args: unknown[]) => unknown
  getClass(): new (...args: unknown[]) => unknown
}

interface CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean>
}

interface DynamicModule {
  module: unknown
  providers: unknown[]
  exports: unknown[]
}

// ---------------------------------------------------------------------------
// Metadata key for the @AgentAuth() decorator
// ---------------------------------------------------------------------------

const AGENTAUTH_MIN_SCORE_KEY = 'agentauth:minScore'

// ---------------------------------------------------------------------------
// AgentAuthService — wraps AgentAuthEngine for NestJS DI
// ---------------------------------------------------------------------------

export class AgentAuthService {
  private engine: AgentAuthEngine

  constructor(config: AgentAuthConfig) {
    this.engine = new AgentAuthEngine(config)
  }

  async initChallenge(options?: InitChallengeOptions): Promise<InitChallengeResult> {
    return this.engine.initChallenge(options)
  }

  async getChallenge(id: string, sessionToken: string) {
    return this.engine.getChallenge(id, sessionToken)
  }

  async solveChallenge(id: string, input: SolveInput) {
    return this.engine.solveChallenge(id, input)
  }

  async verifyToken(token: string): Promise<VerifyTokenResult> {
    return this.engine.verifyToken(token)
  }
}

// ---------------------------------------------------------------------------
// AgentAuthGuard — NestJS guard that validates JWT and enforces minScore
// ---------------------------------------------------------------------------

export interface AgentAuthGuardOptions {
  minScore?: number
}

export class AgentAuthGuard implements CanActivate {
  private service: AgentAuthService
  private defaultMinScore: number

  constructor(service: AgentAuthService, options?: AgentAuthGuardOptions) {
    this.service = service
    this.defaultMinScore = options?.minScore ?? 0.7
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp()
    const req = http.getRequest<NestRequest>()
    const res = http.getResponse<NestResponse>()

    // Extract Bearer token
    const authHeader = req.headers.authorization as string | undefined
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        type: 'https://agentauth.dev/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Missing AgentAuth token',
      })
      return false
    }

    const token = authHeader.slice(7)
    const result = await this.service.verifyToken(token)

    if (!result.valid) {
      res.status(401).json({
        type: 'https://agentauth.dev/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or expired AgentAuth token',
      })
      return false
    }

    // Determine minScore: prefer decorator metadata, fall back to guard default
    let minScore = this.defaultMinScore
    try {
      const handler = context.getHandler()
      const decoratorScore = Reflect.getMetadata(AGENTAUTH_MIN_SCORE_KEY, handler)
      if (typeof decoratorScore === 'number') {
        minScore = decoratorScore
      }
    } catch {
      // Reflect.getMetadata may not be available — use default
    }

    // Check capability score
    if (result.capabilities) {
      const avg =
        (result.capabilities.reasoning +
          result.capabilities.execution +
          result.capabilities.autonomy +
          result.capabilities.speed +
          result.capabilities.consistency) /
        5
      if (avg < minScore) {
        res.status(403).json({
          type: 'https://agentauth.dev/errors/insufficient-score',
          title: 'Insufficient Capability Score',
          status: 403,
          detail: `Average score ${avg.toFixed(2)} below minimum ${minScore}`,
        })
        return false
      }
    }

    // Set AgentAuth response headers
    const agentHeaders = buildHeaders({
      status: 'verified',
      score: result.capabilities,
      model_family: result.model_family,
      expires_at: result.expires_at,
    })
    for (const [name, value] of Object.entries(agentHeaders)) {
      res.setHeader(name, value)
    }

    return true
  }
}

// ---------------------------------------------------------------------------
// @AgentAuth() — method decorator to set per-route minScore
// ---------------------------------------------------------------------------

export function AgentAuth(options?: { minScore?: number }): MethodDecorator {
  return (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    if (options?.minScore !== undefined) {
      Reflect.defineMetadata(AGENTAUTH_MIN_SCORE_KEY, options.minScore, descriptor.value)
    }
    return descriptor
  }
}

// ---------------------------------------------------------------------------
// AgentAuthModule — dynamic module factory for NestJS DI
// ---------------------------------------------------------------------------

export class AgentAuthModule {
  static forRoot(config: AgentAuthConfig): DynamicModule {
    const service = new AgentAuthService(config)
    const guard = new AgentAuthGuard(service)

    return {
      module: AgentAuthModule,
      providers: [
        { provide: AgentAuthService, useValue: service },
        { provide: AgentAuthGuard, useValue: guard },
      ],
      exports: [AgentAuthService, AgentAuthGuard],
    }
  }
}

export { AGENTAUTH_MIN_SCORE_KEY }
