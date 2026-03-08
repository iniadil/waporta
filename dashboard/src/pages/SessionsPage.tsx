import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { SessionCard } from '../components/sessions/SessionCard'
import { CreateSession } from '../components/sessions/CreateSession'
import { useSessions } from '../hooks/useSessions'

export function SessionsPage() {
  const { sessions, loading, error, refresh } = useSessions()
  const [creating, setCreating] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 4 }}>SYSTEM / SESSIONS</div>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-bright)' }}>Session Management</h1>
        </div>
        <Button onClick={() => setCreating(true)}>+ NEW SESSION</Button>
      </div>

      {error && (
        <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 12px', border: '1px solid var(--red-dim)' }}>
          {error}
        </div>
      )}

      {loading && sessions.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div style={{
          border: '1px dashed var(--border)',
          padding: '40px 24px',
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontSize: 12,
        }}>
          No sessions found. Create one to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sessions.map((s) => (
            <SessionCard key={s} sessionId={s} onDeleted={refresh} />
          ))}
        </div>
      )}

      {creating && (
        <CreateSession
          onCreated={refresh}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}
