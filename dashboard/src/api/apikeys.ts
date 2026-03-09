import { apiFetch } from './client'

export interface ApiKeyItem {
  id: string
  name: string
  maskedKey: string
  createdAt: string
}

export interface ApiKeyCreated {
  id: string
  name: string
  key: string
  createdAt: string
}

export function listApiKeys(): Promise<ApiKeyItem[]> {
  return apiFetch<ApiKeyItem[]>('/keys', undefined, true)
}

export function createApiKey(name: string): Promise<ApiKeyCreated> {
  return apiFetch<ApiKeyCreated>('/keys', { method: 'POST', body: JSON.stringify({ name }) }, true)
}

export function deleteApiKey(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/keys/${id}`, { method: 'DELETE' }, true)
}
