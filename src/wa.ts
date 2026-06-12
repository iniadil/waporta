import { Whatsapp, SQLiteAdapter, baileys } from 'wa-multi-session'
import { onQR, clearQR } from './events.js'
import { markConnected, markDisconnected } from './lib/session-guard.js'
import { webhookDispatcher } from './webhooks/singletons.js'

// wa-multi-session meng-hardcode Browsers.ubuntu("Chrome") sebagai fingerprint
// perangkat. Kombinasi Ubuntu+Chrome jarang pada sesi WhatsApp Web asli dan
// lebih menonjol bagi deteksi anti-bot. Kita arahkan ke macOS — fingerprint
// default Baileys dan yang paling umum. Hanya OS yang berubah; nama browser
// tetap dipertahankan sehingga companion platform (CHROME) dan pairing code
// tetap berfungsi. Harus dijalankan sebelum sesi mana pun di-start.
baileys.Browsers.ubuntu = (browser) => baileys.Browsers.macOS(browser)

const wa = new Whatsapp({
  adapter: new SQLiteAdapter(),
  // WA_DISABLE_AUTOLOAD=true mencegah koneksi sesi tersimpan saat boot —
  // dipakai oleh gen:swagger / CI agar tidak membuka koneksi WhatsApp nyata.
  autoLoad: process.env.WA_DISABLE_AUTOLOAD !== 'true',
  onConnecting: (sessionId) => console.log(`[${sessionId}] Connecting...`),
  onConnected: (sessionId) => { clearQR(sessionId); markConnected(sessionId); console.log(`[${sessionId}] Connected`) },
  onDisconnected: (sessionId) => { markDisconnected(sessionId); console.log(`[${sessionId}] Disconnected`) },
  onQRUpdated: (qrData) => { const d = qrData as unknown as { sessionId: string; qr: string }; onQR(d.sessionId, d.qr); console.log('QR Code updated') },
  onMessageReceived: (msg) => {
    // Abaikan pesan keluar/diri sendiri agar webhook tidak terpicu oleh kiriman
    // kita sendiri (mencegah reply-loop pada consumer yang auto-reply).
    if ((msg as unknown as { key?: { fromMe?: boolean } }).key?.fromMe) return
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
