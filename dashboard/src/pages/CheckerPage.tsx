import { NumberChecker } from '../components/checker/NumberChecker'
import { useSessions } from '../hooks/useSessions'

export function CheckerPage() {
  const { sessions } = useSessions()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="animate-fade-in">
        <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 4 }}>SYSTEM / CHECKER</div>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-bright)' }}>Number Checker</h1>
      </div>
      <NumberChecker sessions={sessions} />
    </div>
  )
}
