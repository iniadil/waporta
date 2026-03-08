import { apiFetch } from './client'

export const getSessions = () =>
  apiFetch<{ sessions: string[] }>('/sessions')

export const startSession = (sessionId: string) =>
  apiFetch<{ status: string; sessionId: string }>(`/sessions/${sessionId}`, { method: 'POST' })

export const deleteSession = (sessionId: string) =>
  apiFetch<{ status: string; sessionId: string }>(`/sessions/${sessionId}`, { method: 'DELETE' })

export const getSessionStatus = (sessionId: string) =>
  apiFetch<{ sessionId: string; session: Record<string, unknown> }>(`/sessions/${sessionId}`)

export const getQR = (sessionId: string) =>
  apiFetch<{ qr: string | null }>(`/sessions/${sessionId}/qr`)

export const startWithPairingCode = (sessionId: string, phoneNumber: string) =>
  apiFetch<{ status: string; sessionId: string; pairingCode: string }>(
    `/sessions/${sessionId}/pairing-code`,
    { method: 'POST', body: JSON.stringify({ phoneNumber }) }
  )
