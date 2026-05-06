import { useState, type FormEvent } from 'react'
import { StatusBadge } from '../ui/StatusBadge'
import { deleteSession } from '../../api/sessions'
import { ApiError } from '../../api/client'
import {
  createWebhookUrl,
  deleteWebhookUrl,
  listWebhookUrls,
  type WebhookUrlRecord,
} from '../../api/webhooks'

interface Props {
  sessionId: string
  onDeleted: () => void
}

function getWebhookErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.message === 'duplicate_webhook_url') {
      const details = error.details as { existingId?: unknown } | null
      const existingId = typeof details?.existingId === 'string' ? details.existingId : null
      return existingId
        ? `Duplicate webhook URL. Existing record: ${existingId}`
        : 'Duplicate webhook URL for this session.'
    }
    return error.message
  }
  return error instanceof Error ? error.message : fallback
}

export function SessionCard({ sessionId, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [webhooksOpen, setWebhooksOpen] = useState(false)
  const [webhooksLoaded, setWebhooksLoaded] = useState(false)
  const [webhooksLoading, setWebhooksLoading] = useState(false)
  const [webhooks, setWebhooks] = useState<WebhookUrlRecord[]>([])
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookError, setWebhookError] = useState('')
  const [webhookCreating, setWebhookCreating] = useState(false)
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null)

  const loadWebhooks = async () => {
    setWebhooksLoading(true)
    setWebhookError('')
    try {
      const records = await listWebhookUrls(sessionId)
      setWebhooks(records)
      setWebhooksLoaded(true)
    } catch (e) {
      setWebhookError(getWebhookErrorMessage(e, 'Failed to load webhook URLs'))
    } finally {
      setWebhooksLoading(false)
    }
  }

  const toggleWebhooks = () => {
    const nextOpen = !webhooksOpen
    setWebhooksOpen(nextOpen)
    if (nextOpen && !webhooksLoaded && !webhooksLoading) {
      void loadWebhooks()
    }
  }

  const handleCreateWebhook = async (event: FormEvent) => {
    event.preventDefault()
    const url = webhookUrl.trim()
    if (!url) return

    setWebhookCreating(true)
    setWebhookError('')
    try {
      const created = await createWebhookUrl(sessionId, url)
      setWebhooks((prev) => [...prev, created])
      setWebhooksLoaded(true)
      setWebhookUrl('')
    } catch (e) {
      setWebhookError(getWebhookErrorMessage(e, 'Failed to create webhook URL'))
    } finally {
      setWebhookCreating(false)
    }
  }

  const handleDeleteWebhook = async (id: string) => {
    setDeletingWebhookId(id)
    setWebhookError('')
    try {
      await deleteWebhookUrl(sessionId, id)
      setWebhooks((prev) => prev.filter((record) => record.id !== id))
    } catch (e) {
      setWebhookError(getWebhookErrorMessage(e, 'Failed to delete webhook URL'))
    } finally {
      setDeletingWebhookId(null)
    }
  }

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
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <span style={{ color: 'var(--text-bright)', fontWeight: 500, fontSize: 13, overflowWrap: 'anywhere' }}>
            {sessionId}
          </span>
          <StatusBadge status="unknown" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={toggleWebhooks}
            aria-expanded={webhooksOpen}
            style={{
              color: webhooksOpen ? 'var(--amber)' : 'var(--text-dim)',
              fontSize: 11,
              fontFamily: 'inherit',
              cursor: 'pointer',
              padding: '2px 6px',
              letterSpacing: '0.05em',
            }}
          >
            {webhooksOpen ? '[WEBHOOKS -]' : `[WEBHOOKS${webhooksLoaded ? ` ${webhooks.length}` : ''}]`}
          </button>
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
              style={{ color: 'var(--text-dim)', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', background: 'none', border: 'none' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--red)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
            >
              [X]
            </button>
          )}
        </div>
      </div>

      {webhooksOpen && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '14px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: 'var(--bg)',
        }}>
          <form onSubmit={handleCreateWebhook} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://example.com/whatsapp"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="submit"
              disabled={webhookCreating || webhookUrl.trim().length === 0}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--amber)',
                color: webhookCreating ? 'var(--text-dim)' : 'var(--amber)',
                fontSize: 11,
                letterSpacing: '0.08em',
                cursor: webhookCreating ? 'not-allowed' : 'pointer',
                opacity: webhookCreating || webhookUrl.trim().length === 0 ? 0.55 : 1,
                flexShrink: 0,
              }}
            >
              {webhookCreating ? 'ADDING...' : '[ ADD ]'}
            </button>
          </form>

          {webhookError && (
            <div style={{ color: 'var(--red)', fontSize: 11, padding: '7px 10px', border: '1px solid var(--red-dim)' }}>
              ERROR: {webhookError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em' }}>
              WEBHOOK URLS ({webhooksLoading ? '...' : webhooks.length})
            </div>

            {webhooksLoading ? (
              <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '8px 0' }}>Loading webhook URLs...</div>
            ) : webhooks.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '8px 0' }}>
                No webhook URLs configured for this session.
              </div>
            ) : (
              webhooks.map((record) => (
                <div key={record.id} style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-panel)',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                    <span style={{ color: 'var(--text-bright)', fontSize: 12, overflowWrap: 'anywhere' }}>{record.url}</span>
                    <span style={{ color: record.enabled ? 'var(--green)' : 'var(--text-dim)', fontSize: 10, letterSpacing: '0.08em' }}>
                      {record.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                      id: {record.id}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                      created: {new Date(record.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => void handleDeleteWebhook(record.id)}
                    disabled={deletingWebhookId === record.id}
                    style={{
                      color: 'var(--red)',
                      border: '1px solid var(--red-dim)',
                      padding: '4px 10px',
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      alignSelf: 'flex-start',
                      cursor: deletingWebhookId === record.id ? 'not-allowed' : 'pointer',
                      opacity: deletingWebhookId === record.id ? 0.55 : 1,
                      flexShrink: 0,
                    }}
                  >
                    {deletingWebhookId === record.id ? 'DELETING...' : '[ DELETE ]'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
