import { Whatsapp, SQLiteAdapter } from 'wa-multi-session'
import { onQR, clearQR } from './events.js'
import { webhookDispatcher } from './webhooks/singletons.js'

const wa = new Whatsapp({
  adapter: new SQLiteAdapter(),
  onConnecting: (sessionId) => console.log(`[${sessionId}] Connecting...`),
  onConnected: (sessionId) => { clearQR(sessionId); console.log(`[${sessionId}] Connected`) },
  onDisconnected: (sessionId) => console.log(`[${sessionId}] Disconnected`),
  onQRUpdated: (qrData) => { const d = qrData as unknown as { sessionId: string; qr: string }; onQR(d.sessionId, d.qr); console.log('QR Code updated') },
  onMessageReceived: (msg) => {
    console.log(`[${msg.sessionId}] Message received:`, JSON.stringify(msg, null, 2))
    const m = msg as unknown as Record<string, unknown>
    webhookDispatcher.dispatch({
      sessionId: msg.sessionId,
      id: m.id as string | undefined,
      messageId: m.messageId as string | undefined,
      from: m.from as string | undefined,
      to: m.to as string | undefined,
      timestamp: m.timestamp as number | string | undefined,
      type: m.type as string | undefined,
      messageType: m.messageType as string | undefined,
      content: m.content,
      message: m.message,
      raw: msg,
    }).catch((err) => console.error('[webhook] dispatch error:', err))
  },
})

export default wa
