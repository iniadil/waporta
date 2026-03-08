import { apiFetch } from './client'

export const sendText = (sessionId: string, to: string, text: string, isGroup = false) =>
  apiFetch<{ status: string }>('/send/text', {
    method: 'POST',
    body: JSON.stringify({ sessionId, to, text, isGroup }),
  })

export const sendImage = (sessionId: string, to: string, media: string, text?: string, isGroup = false) =>
  apiFetch<{ status: string }>('/send/image', {
    method: 'POST',
    body: JSON.stringify({ sessionId, to, media, text, isGroup }),
  })

export const sendDocument = (sessionId: string, to: string, media: string, filename: string, text?: string, isGroup = false) =>
  apiFetch<{ status: string }>('/send/document', {
    method: 'POST',
    body: JSON.stringify({ sessionId, to, media, filename, text, isGroup }),
  })

export const checkNumber = (sessionId: string, to: string, isGroup = false) =>
  apiFetch<{ exists: boolean }>(`/check?sessionId=${encodeURIComponent(sessionId)}&to=${encodeURIComponent(to)}&isGroup=${isGroup}`)
