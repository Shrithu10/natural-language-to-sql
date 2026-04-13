import type { QueryRequest, QueryResponse } from '@/types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export async function sendQuery(req: QueryRequest): Promise<QueryResponse> {
  const res = await fetch(`${BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Query failed')
  }
  return res.json()
}

export async function getSchema(sessionId: string) {
  const res = await fetch(`${BASE}/schema/${sessionId}`)
  if (!res.ok) throw new Error('Failed to fetch schema')
  return res.json()
}

export async function setSchema(sessionId: string, ddl: string) {
  const res = await fetch(`${BASE}/schema`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, ddl }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Schema update failed')
  }
  return res.json()
}

export async function clearSession(sessionId: string) {
  await fetch(`${BASE}/session/${sessionId}`, { method: 'DELETE' })
}

export async function getConfig() {
  const res = await fetch(`${BASE}/config`)
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
}
