import type { ChallengeData, ChallengeStore } from '../types.js'

/**
 * Postgres-backed challenge store.
 *
 * Accepts any Postgres client that implements the minimal query interface,
 * compatible with `pg` (node-postgres), `postgres` (postgres.js), and `@neondatabase/serverless`.
 *
 * Requires a table:
 *
 * ```sql
 * CREATE TABLE IF NOT EXISTS agentauth_challenges (
 *   id         TEXT PRIMARY KEY,
 *   data       JSONB NOT NULL,
 *   expires_at TIMESTAMPTZ NOT NULL
 * );
 *
 * CREATE INDEX idx_agentauth_expires ON agentauth_challenges (expires_at);
 * ```
 */
export interface PostgresClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>
}

export class PostgresStore implements ChallengeStore {
  private client: PostgresClient
  private table: string

  constructor(client: PostgresClient, options?: { table?: string }) {
    this.client = client
    this.table = options?.table ?? 'agentauth_challenges'
  }

  async set(id: string, data: ChallengeData, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
    await this.client.query(
      `INSERT INTO ${this.table} (id, data, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET data = $2, expires_at = $3`,
      [id, JSON.stringify(data), expiresAt],
    )
  }

  async get(id: string): Promise<ChallengeData | null> {
    const result = await this.client.query(
      `SELECT data FROM ${this.table} WHERE id = $1 AND expires_at > NOW()`,
      [id],
    )
    if (result.rows.length === 0) return null
    const row = result.rows[0]
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
    return data as ChallengeData
  }

  async delete(id: string): Promise<void> {
    await this.client.query(`DELETE FROM ${this.table} WHERE id = $1`, [id])
  }
}
