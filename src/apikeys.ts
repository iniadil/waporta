import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { randomBytes } from 'crypto'

const DIR = 'data'
const FILE = `${DIR}/api_keys.json`

mkdirSync(DIR, { recursive: true })

export interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
}

function load(): ApiKey[] {
  if (!existsSync(FILE)) return []
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')) as ApiKey[]
  } catch {
    return []
  }
}

function save(keys: ApiKey[]) {
  writeFileSync(FILE, JSON.stringify(keys, null, 2))
}

export interface ApiKeyMasked {
  id: string
  name: string
  maskedKey: string
  createdAt: string
}

export function listKeys(): ApiKeyMasked[] {
  return load().map(({ key, ...rest }) => ({
    ...rest,
    maskedKey: key.slice(0, 12) + '...',
  }))
}

export function createKey(name: string): ApiKey {
  const keys = load()
  const key: ApiKey = {
    id: randomBytes(8).toString('hex'),
    name,
    key: 'wap_' + randomBytes(24).toString('hex'),
    createdAt: new Date().toISOString(),
  }
  keys.push(key)
  save(keys)
  return key
}

export function deleteKey(id: string): boolean {
  const keys = load()
  const idx = keys.findIndex((k) => k.id === id)
  if (idx === -1) return false
  keys.splice(idx, 1)
  save(keys)
  return true
}

export function validateKey(key: string): boolean {
  return load().some((k) => k.key === key)
}
