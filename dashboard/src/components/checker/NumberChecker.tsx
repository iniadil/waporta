import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { checkNumber } from '../../api/messaging'

interface Props {
  sessions: string[]
}

export function NumberChecker({ sessions }: Props) {
  const [sessionId, setSessionId] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ exists: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCheck = async () => {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await checkNumber(sessionId, to)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>SESSION</label>
        <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} style={{ width: '100%' }}>
          <option value="">-- select session --</option>
          {sessions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <Input
        label="PHONE NUMBER"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="6281234567890"
      />

      <Button onClick={handleCheck} disabled={loading || !sessionId || !to}>
        {loading ? 'CHECKING...' : 'CHECK NUMBER'}
      </Button>

      {error && (
        <div style={{
          padding: '10px 14px',
          border: '1px solid var(--red-dim)',
          color: 'var(--red)',
          fontSize: 12,
        }}>
          ERR: {error}
        </div>
      )}

      {result !== null && !error && (
        <div style={{
          padding: '16px 20px',
          border: `1px solid ${result.exists ? 'var(--green-dim)' : 'var(--red-dim)'}`,
          background: result.exists ? 'rgba(0,255,135,0.03)' : 'rgba(255,59,48,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>RESULT FOR {to}</div>
          <div style={{
            fontSize: 20,
            fontWeight: 600,
            color: result.exists ? 'var(--green)' : 'var(--red)',
            letterSpacing: '0.1em',
          }}>
            {result.exists ? '● REGISTERED' : '○ NOT REGISTERED'}
          </div>
        </div>
      )}
    </div>
  )
}
