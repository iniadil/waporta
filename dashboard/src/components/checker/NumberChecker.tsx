import { useState } from 'react'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Field, Label } from '@headlessui/react'
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
      <Listbox value={sessionId} onChange={setSessionId}>
        <Field style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>SESSION</Label>
          <ListboxButton style={{
            width: '100%',
            background: 'var(--bg)',
            border: '1px solid var(--border-bright)',
            color: sessionId ? 'var(--text-bright)' : 'var(--text-dim)',
            padding: '6px 10px',
            fontSize: 13,
            fontFamily: 'IBM Plex Mono, monospace',
            textAlign: 'left',
            cursor: 'pointer',
          }}>
            {sessionId || '-- select session --'}
          </ListboxButton>
          <ListboxOptions
            anchor={{ to: 'bottom start', gap: '4px' }}
            modal={false}
            style={{
              zIndex: 50,
              width: 'var(--button-width)',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-bright)',
              listStyle: 'none',
              padding: 0,
              margin: 0,
              maxHeight: 160,
              overflowY: 'auto',
            }}
          >
            {sessions.length === 0 ? (
              <li style={{ padding: '8px 12px', color: 'var(--text-dim)', fontSize: 12 }}>No sessions available</li>
            ) : sessions.map((s) => (
              <ListboxOption
                key={s}
                value={s}
                className="listbox-option"
              >
                {s}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Field>
      </Listbox>

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
