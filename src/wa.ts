import { Whatsapp, SQLiteAdapter } from 'wa-multi-session'
import { onQR, clearQR } from './events.js'

const wa = new Whatsapp({
  adapter: new SQLiteAdapter(),
  onConnecting: (sessionId) => console.log(`[${sessionId}] Connecting...`),
  onConnected: (sessionId) => { clearQR(sessionId); console.log(`[${sessionId}] Connected`) },
  onDisconnected: (sessionId) => console.log(`[${sessionId}] Disconnected`),
  onQRUpdated: (qr) => { onQR(qr); console.log('QR Code updated') },
  onMessageReceived: (msg) => console.log(`[${msg.sessionId}] Message received:`, JSON.stringify(msg, null, 2)),
})

export default wa
