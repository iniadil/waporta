/**
 * Langganan event Baileys tingkat rendah — satu-satunya tempat kita mendengarkan
 * `sock.ev` secara langsung.
 *
 * Kenapa tidak memakai callback bawaan wa-multi-session? Dua alasan yang
 * keduanya menyebabkan kehilangan data:
 *
 *  1. Pada `messages.update`, library hanya mengambil elemen pertama dari batch
 *     (Whatsapp.js baris 396-400 untuk alur QR dan 529-533 untuk alur pairing).
 *     WhatsApp mengirim pembaruan status sebagai array; sisanya dibuang diam-diam,
 *     sehingga status pengiriman hilang secara acak saat trafik ramai.
 *  2. Pada disconnect, alasan pemutusan (`statusCode`) tersedia di dalam library
 *     tapi tidak diteruskan ke aplikasi — gateway jadi tidak bisa membedakan
 *     nomor yang diblokir dari koneksi yang sekadar putus.
 *
 * `getSessionById()` adalah API publik yang mengembalikan `Session.sock`, jadi
 * kita bisa memasang listener sendiri tanpa menambah tambalan ke node_modules.
 */
import { baileys } from 'wa-multi-session'
import type { WASocket } from 'baileys'
import * as messageState from './message-state.js'
import * as messageLog from './message-log.js'
import { sessionHealth } from './session-health-store.js'
import { registry } from './notifier.js'
import { webhookDispatcher } from '../webhooks/singletons.js'

const WEBHOOK_STATUS_EVENTS = process.env.WEBHOOK_STATUS_EVENTS === 'true'

// Reconnect membuat socket yang benar-benar baru, jadi penanda dipasang pada
// objek socket-nya — bukan pada sessionId — agar pemasangan ulang tetap terjadi
// setelah reconnect tanpa menumpuk listener ganda pada socket yang sama.
const attached = new WeakSet<object>()

/**
 * Peta kode status WhatsApp (WAProto Status) ke istilah kita.
 * Sengaja tidak memakai `parseMessageStatusCodeToReadable` milik library:
 * fungsi itu memetakan status `undefined` menjadi "error", sehingga pembaruan
 * yang bukan tentang status (edit pesan, reaksi) akan salah dilaporkan gagal.
 */
export function mapStatus(code: number): messageState.WhatsAppDeliveryStatus {
  switch (code) {
    case 0:
      return 'error'
    case 1:
      return 'pending'
    case 2:
      return 'server'
    case 3:
      return 'delivered'
    case 4:
      return 'read'
    case 5:
      return 'played'
    default:
      return 'pending'
  }
}

/**
 * Pasang listener pada socket milik sebuah sesi. Aman dipanggil berkali-kali;
 * pemanggilan untuk socket yang sudah terpasang tidak melakukan apa pun.
 */
export async function attachSessionListeners(sessionId: string): Promise<void> {
  try {
    // Import dinamis memutus siklus modul: wa.ts memanggil fungsi ini dari
    // callback lifecycle-nya, sementara fungsi ini butuh instance dari wa.ts.
    const { default: wa } = await import('../wa.js')
    const session = await wa.getSessionById(sessionId)
    const sock = session?.sock as WASocket | undefined
    if (!sock || attached.has(sock)) return
    attached.add(sock)

    sock.ev.on('messages.update', (updates) => {
      for (const u of updates) {
        const status = u.update?.status
        // Pembaruan tanpa status bukan tentang pengiriman (mis. edit, reaksi).
        if (status === undefined || status === null) continue
        // Status pengiriman hanya relevan untuk pesan yang kita kirim sendiri.
        if (!u.key?.fromMe) continue
        const messageId = u.key.id
        if (!messageId) continue

        const readable = mapStatus(status)
        messageState.updateStatus(messageId, readable)

        messageLog.append({
          event: 'message.status',
          sessionId,
          messageId,
          peer: u.key.remoteJid ?? undefined,
          status: readable,
        })

        if (WEBHOOK_STATUS_EVENTS) {
          webhookDispatcher
            .dispatchStatus({
              sessionId,
              messageId,
              recipient: u.key.remoteJid ?? undefined,
              status: readable,
            })
            .catch((err) => console.error('[webhook] dispatch status error:', err))
        }
      }
    })

    sock.ev.on('connection.update', (update) => {
      if (update.connection !== 'close') return
      const code = (
        update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
      )?.output?.statusCode
      if (code === undefined) return
      handleSessionClosed(sessionId, code)
    })
  } catch (err) {
    // Listener adalah lapisan observabilitas; kegagalan memasangnya tidak boleh
    // menjatuhkan sesi yang baru saja tersambung.
    console.warn(`[wa-events] gagal memasang listener untuk ${sessionId}:`, err)
  }
}

/**
 * WhatsApp memutus sesi dengan alasan tertentu.
 *
 * HANYA `forbidden` (403) yang diperlakukan sebagai ban. `badSession` (500)
 * sengaja TIDAK dipakai: di Baileys nilai itu adalah fallback terakhir untuk
 * stream error apa pun yang datang tanpa atribut `code` yang dikenal
 * (Utils/generics.js, getErrorCodeFromStreamError). Memperlakukannya sebagai ban
 * berarti satu gangguan server biasa akan menandai nomor sehat sebagai
 * diblokir secara permanen, lengkap dengan notifikasi palsu ke admin dan saran
 * yang salah untuk mengganti nomor.
 */
function handleSessionClosed(sessionId: string, code: number): void {
  const { DisconnectReason } = baileys
  if (code !== DisconnectReason.forbidden) return

  // Store ini juga yang dibaca assertNotBanned di jalur kirim, jadi satu
  // penulisan sudah cukup untuk memblokir pengiriman berikutnya.
  void sessionHealth.markBanned(sessionId, code)

  console.error(
    `[wa-events] sesi ${sessionId} ditolak WhatsApp (statusCode=${code}); pengiriman diblokir`,
  )

  registry
    .notifyAll({
      kind: 'session',
      sessionId,
      error: `Session rejected by WhatsApp (statusCode=${code})`,
      timestamp: new Date().toISOString(),
    })
    .catch(() => {})
}
