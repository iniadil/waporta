const BASE_WA = '/api/whatsapp'
const BASE_KEYS = '/api'

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

function getErrorMessage(data: unknown): string {
  if (data != null && typeof data === 'object' && 'error' in data) {
    const error = (data as { error?: unknown }).error
    if (typeof error === 'string') return error
  }
  return 'Request failed'
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
  const text = await res.text()
  const data = text.length > 0 ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, getErrorMessage(data), data)
  return data as T
}
