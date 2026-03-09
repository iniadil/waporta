import { useState, useEffect, type FormEvent } from 'react'
import { listApiKeys, createApiKey, deleteApiKey, type ApiKeyItem, type ApiKeyCreated } from '../api/apikeys'

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<ApiKeyCreated | null>(null)
  const [copied, setCopied] = useState(false)

  async function fetchKeys() {
    try {
      setKeys(await listApiKeys())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load keys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchKeys() }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const created = await createApiKey(name.trim())
      setNewKey(created)
      setName('')
      await fetchKeys()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create key')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteApiKey(id)
      setKeys((prev) => prev.filter((k) => k.id !== id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete key')
    }
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div className="animate-fade-in">
        <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 4 }}>
          SYSTEM / API KEYS
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-bright)' }}>
          API Key Management
        </h1>
      </div>

      {error && (
        <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 12px', border: '1px solid var(--red-dim)' }}>
          ERROR: {error}
        </div>
      )}

      {/* New key modal */}
      {newKey && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            width: 480, border: '1px solid var(--amber)', background: 'var(--bg-panel)', padding: 32,
          }}>
            <div style={{ fontSize: 10, color: 'var(--amber)', letterSpacing: '0.12em', marginBottom: 12 }}>
              ⚠ API KEY CREATED — COPY NOW
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 16 }}>
              This key will not be shown again. Store it securely.
            </div>
            <div style={{
              padding: '10px 12px', border: '1px solid var(--border-bright)',
              background: 'var(--bg)', fontSize: 12, color: 'var(--green)',
              wordBreak: 'break-all', marginBottom: 16,
            }}>
              {newKey.key}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleCopy}
                style={{
                  padding: '7px 14px', border: '1px solid var(--border-bright)',
                  color: copied ? 'var(--green)' : 'var(--text)', fontSize: 11,
                  letterSpacing: '0.08em',
                }}
              >
                {copied ? '✓ COPIED' : '[ COPY ]'}
              </button>
              <button
                onClick={() => { setNewKey(null); setCopied(false) }}
                style={{
                  padding: '7px 14px', border: '1px solid var(--red-dim)',
                  color: 'var(--red)', fontSize: 11, letterSpacing: '0.08em',
                }}
              >
                [ CLOSE ]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      <div className="animate-fade-in-delay-1" style={{
        border: '1px solid var(--border)', background: 'var(--bg-panel)', padding: 20,
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 12 }}>
          CREATE NEW KEY
        </div>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Key name (e.g. production-bot)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            style={{
              padding: '6px 16px', border: '1px solid var(--amber)',
              color: creating ? 'var(--text-dim)' : 'var(--amber)',
              fontSize: 11, letterSpacing: '0.08em', cursor: creating ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'CREATING...' : '[ GENERATE ]'}
          </button>
        </form>
      </div>

      {/* Key list */}
      <div className="animate-fade-in-delay-2" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em' }}>
          ACTIVE KEYS ({loading ? '...' : keys.length})
        </div>
        {loading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>Loading...</div>
        ) : keys.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '12px 0' }}>
            No API keys. Create one above.
          </div>
        ) : (
          keys.map((k) => (
            <div key={k.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', border: '1px solid var(--border)', background: 'var(--bg-panel)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-bright)' }}>{k.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                  {k.maskedKey}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {new Date(k.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => handleDelete(k.id)}
                style={{
                  padding: '5px 12px', border: '1px solid var(--red-dim)',
                  color: 'var(--red)', fontSize: 11, letterSpacing: '0.08em',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--red)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--red-dim)' }}
              >
                [ DELETE ]
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
