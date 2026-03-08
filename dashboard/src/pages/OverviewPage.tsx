import { useSessions } from '../hooks/useSessions'
import type { Page } from '../components/layout/Sidebar'

interface Props {
  onNavigate: (page: Page) => void
}

function StatCard({ label, value, delay }: { label: string; value: number | string; delay: number }) {
  return (
    <div
      className={`animate-fade-in-delay-${delay}`}
      style={{
        border: '1px solid var(--border)',
        padding: '20px 24px',
        background: 'var(--bg-panel)',
        flex: 1,
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--amber)', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}

export function OverviewPage({ onNavigate }: Props) {
  const { sessions, loading, error } = useSessions()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div className="animate-fade-in">
        <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 4 }}>
          SYSTEM / OVERVIEW
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-bright)' }}>
          Operations Dashboard
        </h1>
      </div>

      {error && (
        <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 12px', border: '1px solid var(--red-dim)' }}>
          CONNECTION ERROR: {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="TOTAL SESSIONS" value={loading ? '—' : sessions.length} delay={1} />
        <StatCard label="ACTIVE" value={loading ? '—' : sessions.length} delay={2} />
        <StatCard label="API STATUS" value="ONLINE" delay={3} />
      </div>

      <div className="animate-fade-in-delay-4" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 4 }}>
          QUICK ACTIONS
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'MANAGE SESSIONS', page: 'sessions' as Page },
            { label: 'SEND MESSAGE', page: 'messaging' as Page },
            { label: 'CHECK NUMBER', page: 'checker' as Page },
          ].map((item) => (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              style={{
                padding: '8px 16px',
                border: '1px solid var(--border-bright)',
                color: 'var(--text-dim)',
                fontSize: 11,
                letterSpacing: '0.08em',
                cursor: 'pointer',
                background: 'none',
                fontFamily: 'IBM Plex Mono, monospace',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-dim)' }}
            >
              → {item.label}
            </button>
          ))}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="animate-fade-in-delay-4" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em' }}>
            ACTIVE SESSIONS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sessions.map((s) => (
              <div key={s} style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} className="pulse-green" />
                {s}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
