import { Whatsapp, SQLiteAdapter, baileys } from 'wa-multi-session'
import { onQR, clearQR } from './events.js'
import { markConnected, markDisconnected, relaxWarmup } from './lib/session-guard.js'
import { sessionHealth } from './lib/session-health-store.js'
import { attachSessionListeners } from './lib/wa-events.js'
import * as messageLog from './lib/message-log.js'
import { webhookDispatcher } from './webhooks/singletons.js'

// Mencetak seluruh payload pesan berarti menyalin isi percakapan pengguna ke
// stdout — dan pada deployment Docker, ke log container yang biasanya dikirim
// ke agregator pihak ketiga. Default-nya sekarang hanya ringkasan.
const LOG_PAYLOAD = process.env.LOG_MESSAGE_PAYLOAD === 'true'

// wa-multi-session meng-hardcode Browsers.ubuntu("Chrome") sebagai fingerprint
// perangkat. Kombinasi Ubuntu+Chrome jarang pada sesi WhatsApp Web asli dan
// lebih menonjol bagi deteksi anti-bot. Kita arahkan ke macOS — fingerprint
// default Baileys dan yang paling umum. Hanya OS yang berubah; nama browser
// tetap dipertahankan sehingga companion platform (CHROME) dan pairing code
// tetap berfungsi. Harus dijalankan sebelum sesi mana pun di-start.
baileys.Browsers.ubuntu = (browser) => baileys.Browsers.macOS(browser)

// Dipegang terpisah karena adopsi sesi lama membutuhkan daftar sesi TERSIMPAN.
// wa.getSessionsIds() tidak bisa dipakai untuk itu: fungsi itu mengembalikan
// sesi yang sedang berjalan di memori, yang saat boot masih kosong.
const adapter = new SQLiteAdapter()

const wa = new Whatsapp({
  adapter,
  // WA_DISABLE_AUTOLOAD=true mencegah koneksi sesi tersimpan saat boot —
  // dipakai oleh gen:swagger / CI agar tidak membuka koneksi WhatsApp nyata.
  autoLoad: process.env.WA_DISABLE_AUTOLOAD !== 'true',
  onConnecting: (sessionId) => {
    // Socket sudah ada begitu sesi masuk fase connecting, jadi listener bisa
    // dipasang lebih awal — penting agar peristiwa disconnect yang terjadi
    // sebelum koneksi sempat terbuka (mis. nomor ditolak) tetap tertangkap.
    void attachSessionListeners(sessionId)
    console.log(`[${sessionId}] Connecting...`)
  },
  onConnected: (sessionId) => {
    clearQR(sessionId)
    // Sampai store menjawab, sesi diperlakukan sebagai pairing baru — sikap
    // yang lebih aman bila jawabannya ternyata terlambat.
    markConnected(sessionId, true)
    void wa
      .getSessionById(sessionId)
      // JID pemilik dipakai store untuk mengenali sessionId yang dipakai ulang
      // dengan nomor berbeda; nomor seperti itu harus dihitung sebagai baru.
      .then((session) => sessionHealth.markConnected(sessionId, session?.sock?.user?.id))
      .then((isCold) => { if (!isCold) relaxWarmup(sessionId) })
      .catch((err) => console.warn(`[${sessionId}] gagal mencatat status sesi:`, err))
    void attachSessionListeners(sessionId)
    console.log(`[${sessionId}] Connected`)
  },
  onDisconnected: (sessionId) => { markDisconnected(sessionId); console.log(`[${sessionId}] Disconnected`) },
  onQRUpdated: (qrData) => { const d = qrData as unknown as { sessionId: string; qr: string }; onQR(d.sessionId, d.qr); console.log('QR Code updated') },
  onMessageReceived: (msg) => {
    // Abaikan pesan keluar/diri sendiri agar webhook tidak terpicu oleh kiriman
    // kita sendiri (mencegah reply-loop pada consumer yang auto-reply).
    if ((msg as unknown as { key?: { fromMe?: boolean } }).key?.fromMe) return
    const m = msg as unknown as Record<string, unknown>
    console.log(
      `[${msg.sessionId}] Message received type=${m.messageType ?? m.type ?? 'unknown'} id=${m.messageId ?? m.id ?? '-'}`,
    )
    if (LOG_PAYLOAD) console.log(JSON.stringify(msg, null, 2))
    messageLog.append({
      event: 'message.in',
      sessionId: msg.sessionId,
      messageId: (m.messageId ?? m.id) as string | undefined,
      peer: (m.from ??
        (msg as unknown as { key?: { remoteJid?: string } }).key?.remoteJid) as
        | string
        | undefined,
      messageType: (m.messageType ?? m.type) as string | undefined,
      content: m.content ?? m.message,
    })
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

// Saat upgrade dari versi tanpa session-health-store, semua sesi yang sudah
// berjalan harus ditandai matang. Tanpa ini, autoLoad akan menyambungkan
// kembali sesi produksi yang berumur berbulan-bulan dan store — yang masih
// kosong — menganggapnya baru di-pair: warm-up 30 menit plus kuota 20 pesan
// sehari, tepat setelah admin melakukan deploy. Adopsi hanya berjalan sekali.
void adapter
  .listSessions()
  .then((ids) => sessionHealth.adoptExisting(ids))
  .then((adopted) => {
    // Sebagian sesi bisa saja sudah tersambung sebelum adopsi selesai dan
    // terlanjur mendapat warm-up penuh; longgarkan secara surut.
    for (const sessionId of adopted) relaxWarmup(sessionId)
  })
  .catch((err) => console.warn('[session-health] adopsi sesi lama gagal:', err))

export default wa
