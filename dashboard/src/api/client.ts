const BASE_WA = '/api/whatsapp'
const BASE_KEYS = '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit, useKeysBase = false): Promise<T> {
  const base = useKeysBase ? BASE_KEYS : BASE_WA
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${base}${path}`, { ...init, headers })
  const data = await res.json()
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Request failed')
  return data as T
}
