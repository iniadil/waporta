import { MessageSender } from '../components/messaging/MessageSender'
import { useSessions } from '../hooks/useSessions'

export function MessagingPage() {
  const { sessions } = useSessions()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="animate-fade-in">
        <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 4 }}>SYSTEM / MESSAGING</div>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-bright)' }}>Send Messages</h1>
      </div>
      <div style={{ maxWidth: 600 }}>
        <MessageSender sessions={sessions} />
      </div>
    </div>
  )
}
