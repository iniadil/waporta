import { useState } from 'react'
import {
  TabGroup, TabList, Tab, TabPanels, TabPanel,
  Listbox, ListboxButton, ListboxOption, ListboxOptions,
  Field, Label, Textarea,
} from '@headlessui/react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { sendText, sendImage, sendDocument } from '../../api/messaging'

interface Props {
  sessions: string[]
}

const tabStyle = (selected: boolean): React.CSSProperties => ({
  padding: '6px 14px',
  fontSize: 11,
  letterSpacing: '0.08em',
  color: selected ? 'var(--amber)' : 'var(--text-dim)',
  cursor: 'pointer',
  background: selected ? 'var(--bg-hover)' : 'none',
  border: '1px solid',
  borderColor: selected ? 'var(--amber)' : 'var(--border)',
  fontFamily: 'IBM Plex Mono, monospace',
  transition: 'all 0.15s',
  marginRight: 4,
  outline: 'none',
})

export function MessageSender({ sessions }: Props) {
  const [sessionId, setSessionId] = useState('')
  const [to, setTo] = useState('')
  const [text, setText] = useState('')
  const [media, setMedia] = useState('')
  const [filename, setFilename] = useState('')
  const [isGroup, setIsGroup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [tabIndex, setTabIndex] = useState(0)

  const tabs = ['TEXT', 'IMAGE', 'DOCUMENT']

  const handleSend = async () => {
    setLoading(true)
    setResult(null)
    try {
      if (tabIndex === 0) await sendText(sessionId, to, text, isGroup)
      else if (tabIndex === 1) await sendImage(sessionId, to, media, text || undefined, isGroup)
      else await sendDocument(sessionId, to, media, filename, text || undefined, isGroup)
      setResult({ ok: true, msg: 'Message sent successfully' })
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Send failed' })
    } finally {
      setLoading(false)
    }
  }

  const canSend = sessionId && to && (
    tabIndex === 0 ? !!text :
    tabIndex === 1 ? !!media :
    !!(media && filename)
  )

  return (
    <TabGroup selectedIndex={tabIndex} onChange={setTabIndex}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <TabList style={{ display: 'flex', flexWrap: 'wrap' }}>
          {tabs.map((t, i) => (
            <Tab key={t} style={tabStyle(tabIndex === i)}>{t}</Tab>
          ))}
        </TabList>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Listbox value={sessionId} onChange={setSessionId}>
            <Field style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>SESSION</Label>
              <div style={{ position: 'relative' }}>
                <ListboxButton style={{
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border-bright)',
                  color: sessionId ? 'var(--text-bright)' : 'var(--text-dim)',
                  padding: '6px 30px 6px 10px',
                  fontSize: 13,
                  fontFamily: 'IBM Plex Mono, monospace',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}>
                  {sessionId || '-- select session --'}
                </ListboxButton>
                <ListboxOptions style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-bright)',
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  maxHeight: 160,
                  overflowY: 'auto',
                }}>
                  {sessions.length === 0 ? (
                    <li style={{ padding: '8px 12px', color: 'var(--text-dim)', fontSize: 12 }}>No sessions</li>
                  ) : sessions.map((s) => (
                    <ListboxOption
                      key={s}
                      value={s}
                      style={({ focus, selected }) => ({
                        padding: '7px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        color: selected ? 'var(--amber)' : focus ? 'var(--text-bright)' : 'var(--text)',
                        background: focus ? 'var(--bg-hover)' : 'transparent',
                      })}
                    >
                      {s}
                    </ListboxOption>
                  ))}
                </ListboxOptions>
              </div>
            </Field>
          </Listbox>

          <Input
            label="TO (phone or JID)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="6281234567890"
          />
        </div>

        <TabPanels>
          <TabPanel style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>MESSAGE</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="Hello!"
                style={{
                  resize: 'vertical',
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border-bright)',
                  color: 'var(--text-bright)',
                  padding: '8px 10px',
                  fontSize: 13,
                  fontFamily: 'IBM Plex Mono, monospace',
                  outline: 'none',
                }}
              />
            </Field>
          </TabPanel>

          <TabPanel style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input label="MEDIA URL OR BASE64" value={media} onChange={(e) => setMedia(e.target.value)} placeholder="https://..." />
            <Field style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>CAPTION (optional)</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                style={{
                  resize: 'vertical',
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border-bright)',
                  color: 'var(--text-bright)',
                  padding: '8px 10px',
                  fontSize: 13,
                  fontFamily: 'IBM Plex Mono, monospace',
                  outline: 'none',
                }}
              />
            </Field>
          </TabPanel>

          <TabPanel style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input label="MEDIA URL OR BASE64" value={media} onChange={(e) => setMedia(e.target.value)} placeholder="https://..." />
            <Input label="FILENAME" value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="document.pdf" />
            <Field style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>CAPTION (optional)</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                style={{
                  resize: 'vertical',
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border-bright)',
                  color: 'var(--text-bright)',
                  padding: '8px 10px',
                  fontSize: 13,
                  fontFamily: 'IBM Plex Mono, monospace',
                  outline: 'none',
                }}
              />
            </Field>
          </TabPanel>
        </TabPanels>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            id="isGroup"
            checked={isGroup}
            onChange={(e) => setIsGroup(e.target.checked)}
            style={{ accentColor: 'var(--amber)' }}
          />
          <label htmlFor="isGroup" style={{ fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer' }}>
            GROUP MESSAGE
          </label>
        </div>

        <Button onClick={handleSend} disabled={loading || !canSend}>
          {loading ? 'SENDING...' : 'SEND MESSAGE'}
        </Button>

        {result && (
          <div style={{
            padding: '10px 14px',
            border: `1px solid ${result.ok ? 'var(--green-dim)' : 'var(--red-dim)'}`,
            color: result.ok ? 'var(--green)' : 'var(--red)',
            background: result.ok ? 'rgba(0,255,135,0.03)' : 'rgba(255,59,48,0.03)',
            fontSize: 12,
          }}>
            {result.ok ? '✓ ' : '✗ '}{result.msg}
          </div>
        )}
      </div>
    </TabGroup>
  )
}
