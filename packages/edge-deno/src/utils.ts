export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}

export function extractBearer(request: Request): string | null {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export function errorResponse(status: number, type: string, err: unknown): Response {
  const detail = err instanceof Error ? err.message : String(err)
  return json({
    type: `https://agentauth.dev/errors/${type}`,
    title: type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    status,
    detail,
  }, status)
}
