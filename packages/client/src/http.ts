export class AgentAuthError extends Error {
  constructor(
    message: string,
    public status: number,
    public type?: string,
  ) {
    super(message)
    this.name = 'AgentAuthError'
  }
}

export class HttpTransport {
  private baseUrl: string
  private apiKey?: string
  private timeout: number

  constructor(config: { baseUrl: string; apiKey?: string; timeout?: number }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.timeout = config.timeout ?? 30000
  }

  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('POST', path, body, headers)
  }

  async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, headers)
  }

  private async request<T>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    }

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new AgentAuthError(
          (data as Record<string, string>).detail ?? (data as Record<string, string>).message ?? `HTTP ${response.status}`,
          response.status,
          (data as Record<string, string>).type,
        )
      }

      return data as T
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
