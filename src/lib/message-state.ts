/**
 * Pelacak status pengiriman per pesan.
 *
 * Latar belakang: `sock.sendMessage` Baileys resolve begitu frame berhasil
 * ditulis ke websocket — bukan setelah server WhatsApp mengonfirmasi. Karena itu
 * balasan `{status:"sent"}` dari endpoint /send/* tidak pernah bisa menjadi bukti
 * pesan benar-benar terkirim. Satu-satunya sinyal otoritatif adalah event
 * `messages.update`, yang dilanggan di lib/wa-events.ts dan bermuara ke sini.
 *
 * State sengaja in-memory: data ini tumbuh satu entri per pesan, sedangkan pola
 * store JSON yang dipakai webhooks (webhooks/store.ts) menulis ulang seluruh file
 * per mutasi — tidak cocok untuk beban seperti itu. Jejak persisten disediakan
 * terpisah oleh lib/message-log.ts.
 *
 * Batasnya harus disadari pemakai: isi hilang saat proses restart, tidak
 * konsisten bila gateway dijalankan multi-instance, dan hanya menyimpan
 * MESSAGE_STATE_MAX pesan terakhir.
 */
import { envNum } from './session-guard.js'

/** Status yang benar-benar dikabarkan WhatsApp lewat event messages.update. */
export type WhatsAppDeliveryStatus =
  | 'pending'
  | 'server'
  | 'delivered'
  | 'read'
  | 'played'
  | 'error'

/**
 * 'socket' adalah status lokal kita sendiri: frame sudah ditulis ke koneksi,
 * tapi WhatsApp belum mengabarkan apa pun. Sisanya berasal dari WhatsApp.
 */
export type DeliveryStatus = 'socket' | WhatsAppDeliveryStatus

export type MessageType = 'text' | 'image' | 'document'

export interface MessageStateRecord {
  messageId: string
  sessionId: string
  to: string
  messageType: MessageType
  status: DeliveryStatus
  createdAt: number
  updatedAt: number
}

const MAX = envNum('MESSAGE_STATE_MAX', 1000)
const TTL_MS = envNum('MESSAGE_STATE_TTL_MS', 60 * 60_000)

// Map di JavaScript mempertahankan urutan penyisipan, jadi entri pertama pada
// iterasi selalu yang tertua — cukup untuk evict FIFO tanpa struktur tambahan.
const records = new Map<string, MessageStateRecord>()

/** MESSAGE_STATE_MAX=0 mematikan pelacakan sepenuhnya. */
export function isEnabled(): boolean {
  return MAX > 0
}

/** Catat pesan yang baru saja ditulis ke koneksi. */
export function record(entry: {
  messageId: string
  sessionId: string
  to: string
  messageType: MessageType
  status?: DeliveryStatus
}): void {
  if (!isEnabled()) return
  const now = Date.now()
  records.set(entry.messageId, {
    messageId: entry.messageId,
    sessionId: entry.sessionId,
    to: entry.to,
    messageType: entry.messageType,
    status: entry.status ?? 'socket',
    createdAt: now,
    updatedAt: now,
  })
  evictOverflow()
}

/**
 * Perbarui status dari event WhatsApp. Pesan yang tidak dikenal (mis. dikirim
 * dari HP pengguna langsung, atau sudah ter-evict) diabaikan — bukan error.
 */
export function updateStatus(messageId: string, status: DeliveryStatus): void {
  if (!isEnabled()) return
  const existing = records.get(messageId)
  if (!existing) return
  existing.status = status
  existing.updatedAt = Date.now()
}

/** Ambil record; mengembalikan undefined bila tidak ada atau sudah lewat TTL. */
export function get(messageId: string): MessageStateRecord | undefined {
  if (!isEnabled()) return undefined
  const found = records.get(messageId)
  if (!found) return undefined
  if (TTL_MS > 0 && Date.now() - found.createdAt > TTL_MS) {
    records.delete(messageId)
    return undefined
  }
  return found
}

/**
 * Buang entri kedaluwarsa lebih dulu, baru entri tertua bila masih melebihi
 * batas. Dijalankan saat penyisipan sehingga tidak perlu timer latar.
 */
function evictOverflow(): void {
  if (TTL_MS > 0) {
    const cutoff = Date.now() - TTL_MS
    for (const [id, rec] of records) {
      // Urutan penyisipan = urutan createdAt, jadi entri pertama yang masih
      // segar menandakan sisanya juga segar.
      if (rec.createdAt > cutoff) break
      records.delete(id)
    }
  }
  while (records.size > MAX) {
    const oldest = records.keys().next()
    if (oldest.done) break
    records.delete(oldest.value)
  }
}
