import { useState } from 'react'
import { StatusBadge } from '../ui/StatusBadge'
import { deleteSession } from '../../api/sessions'

interface Props {
  sessionId: string
  onDeleted: () => void
}

export function SessionCard({ sessionId, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    try {
      await deleteSession(sessionId)
      onDeleted()
    } catch (e) {
      console.error(e)
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        border: '1px solid var(--border)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-panel)',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ color: 'var(--text-bright)', fontWeight: 500, fontSize: 13 }}>
          {sessionId}
        </span>
        <StatusBadge status="unknown" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {confirming && !deleting && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            confirm?&nbsp;
            <button
              onClick={handleDelete}
              style={{ color: 'var(--red)', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', background: 'none', border: 'none' }}
            >
              [Y]
            </button>
            &nbsp;
            <button
              onClick={() => setConfirming(false)}
              style={{ color: 'var(--text-dim)', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', background: 'none', border: 'none' }}
            >
              [N]
            </button>
          </span>
        )}
        {!confirming && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              color: 'var(--text-dim)',
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: '2px 6px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--red)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            [X]
          </button>
        )}
      </div>
    </div>
  )
}
