import { useState } from 'react'
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { QRDisplay } from './QRDisplay'
import { useQR } from '../../hooks/useQR'
import { startSession, startWithPairingCode } from '../../api/sessions'

interface Props {
  onCreated: () => void
  onClose: () => void
}

const tabStyle = (selected: boolean): React.CSSProperties => ({
  padding: '6px 16px',
  fontSize: 11,
  letterSpacing: '0.08em',
  color: selected ? 'var(--amber)' : 'var(--text-dim)',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  borderBottom: selected ? '2px solid var(--amber)' : '2px solid transparent',
  fontFamily: 'IBM Plex Mono, monospace',
  transition: 'all 0.15s',
  outline: 'none',
})

export function CreateSession({ onCreated, onClose }: Props) {
  const [sessionId, setSessionId] = useState('')
  const [phone, setPhone] = useState('')
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [pendingSession, setPendingSession] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tabIndex, setTabIndex] = useState(0)

  const qr = useQR(pendingSession, false)

  const handleQRStart = async () => {
    if (!sessionId.trim()) return
    setLoading(true)
    setError(null)
    try {
      await startSession(sessionId.trim())
      setPendingSession(sessionId.trim())
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start session')
    } finally {
      setLoading(false)
    }
  }

  const handlePairingStart = async () => {
    if (!sessionId.trim() || !phone.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await startWithPairingCode(sessionId.trim(), phone.trim())
      setPairingCode(res.pairingCode)
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: 340,
      background: 'var(--bg-panel)',
      borderLeft: '1px solid var(--border)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      animation: 'fadeIn 0.2s ease forwards',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ color: 'var(--amber)', fontSize: 12, letterSpacing: '0.1em' }}>NEW SESSION</span>
        <button
          onClick={onClose}
          style={{ color: 'var(--text-dim)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none' }}
        >
          [X]
        </button>
      </div>

      <TabGroup selectedIndex={tabIndex} onChange={setTabIndex}>
        <TabList style={{ padding: '0 20px', borderBottom: '1px solid var(--border)', display: 'flex' }}>
          <Tab style={tabStyle(tabIndex === 0)}>QR CODE</Tab>
          <Tab style={tabStyle(tabIndex === 1)}>PAIRING CODE</Tab>
        </TabList>

        <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <Input
            label="SESSION ID"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="e.g. my-session"
            disabled={!!pendingSession || !!pairingCode}
          />

          {error && (
            <div style={{ color: 'var(--red)', fontSize: 11, padding: '8px 10px', border: '1px solid var(--red-dim)', background: 'rgba(255,59,48,0.05)' }}>
              ERR: {error}
            </div>
          )}

          <TabPanels>
            <TabPanel style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: pendingSession ? 'center' : 'flex-start' }}>
              {!pendingSession ? (
                <Button onClick={handleQRStart} disabled={loading || !sessionId.trim()}>
                  {loading ? 'STARTING...' : 'START SESSION'}
                </Button>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
                    SCAN WITH WHATSAPP
                  </div>
                  <QRDisplay qr={qr} />
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>polling every 2s</div>
                </>
              )}
            </TabPanel>

            <TabPanel style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!pairingCode ? (
                <>
                  <Input
                    label="PHONE NUMBER"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 6281234567890"
                  />
                  <Button onClick={handlePairingStart} disabled={loading || !sessionId.trim() || !phone.trim()}>
                    {loading ? 'GENERATING...' : 'GET PAIRING CODE'}
                  </Button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>ENTER IN WHATSAPP</div>
                  <div style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: '0.3em',
                    color: 'var(--green)',
                    padding: '16px 24px',
                    border: '1px solid var(--green-dim)',
                    background: 'rgba(0,255,135,0.03)',
                    textAlign: 'center',
                  }}>
                    {pairingCode}
                  </div>
                </div>
              )}
            </TabPanel>
          </TabPanels>
        </div>
      </TabGroup>
    </div>
  )
}
