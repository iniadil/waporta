import { Whatsapp, SQLiteAdapter } from 'wa-multi-session'

const wa = new Whatsapp({
  adapter: new SQLiteAdapter(),
  onConnecting: (sessionId) => console.log(`[${sessionId}] Connecting...`),
  onConnected: (sessionId) => console.log(`[${sessionId}] Connected`),
  onDisconnected: (sessionId) => console.log(`[${sessionId}] Disconnected`),
  onQRUpdated: (qr) => console.log('QR Code:', qr),
  onMessageReceived: (msg) => console.log(`[${msg.sessionId}] Message received:`, JSON.stringify(msg, null, 2)),
})

export default wa
