/**
 * Jejak pesan opsional dalam format JSONL.
 *
 * Default MATI. Saat aktif, setiap peristiwa ditulis sebagai satu baris JSON ke
 * data/logs/YYYY-MM-DD.jsonl secara append — file tidak pernah dibaca ulang,
 * sehingga biayanya tidak tumbuh seiring ukuran log. Pola store JSON yang
 * dipakai webhooks/store.ts sengaja tidak ditiru di sini karena pola itu
 * menulis ulang seluruh file setiap mutasi.
 *
 * Level:
 *  - off  : tidak menulis apa pun (default)
 *  - meta : hanya metadata; nomor dimasking, isi pesan TIDAK disimpan
 *  - full : metadata + isi pesan
 *
 * Aturan yang tidak boleh dilanggar: kegagalan menulis log tidak boleh
 * menggagalkan pengiriman pesan. Semua kesalahan berakhir pada mode degradasi
 * diam (satu peringatan, lalu berhenti mencatat).
 *
 * Perkiraan biaya pada level meta: ~200 byte per entri. Pada 1000 pesan/hari
 * itu sekitar 200 KB/hari, atau ~1,4 MB untuk seluruh retensi 7 hari.
 */
import { createWriteStream, mkdirSync, readdirSync, statSync, unlinkSync, type WriteStream } from 'fs'
import { envNum } from './session-guard.js'
import { dayKey } from './session-health-store.js'

export type MessageLogLevel = 'off' | 'meta' | 'full'

const DIR = 'data/logs'
const FILE_RE = /^\d{4}-\d{2}-\d{2}\.jsonl$/

function readLevel(): MessageLogLevel {
  // Variabel kosong (mis. diteruskan docker-compose tanpa nilai) sama dengan
  // tidak disetel, bukan nilai tidak dikenal.
  const raw = (process.env.MESSAGE_LOG_LEVEL ?? '').trim().toLowerCase()
  if (raw === '') return 'off'
  if (raw === 'off' || raw === 'meta' || raw === 'full') return raw
  console.warn(`[message-log] MESSAGE_LOG_LEVEL="${raw}" tidak dikenal; memakai "off"`)
  return 'off'
}

const LEVEL = readLevel()
const RETENTION_DAYS = envNum('MESSAGE_LOG_RETENTION_DAYS', 7)
const MAX_BYTES = envNum('MESSAGE_LOG_MAX_BYTES', 10 * 1024 * 1024)

export interface MessageLogEntry {
  event:
    | 'message.in'
    | 'message.out'
    | 'message.status'
    | 'send.error'
  sessionId: string
  messageId?: string
  /** Lawan bicara: pengirim untuk pesan masuk, tujuan untuk pesan keluar. */
  peer?: string
  messageType?: string
  status?: string
  error?: string
  /** Hanya ditulis pada level "full". */
  content?: unknown
}

let stream: WriteStream | undefined
let streamDay = ''
let bytesToday = 0
let operational = true
let sizeWarned = false

export function isEnabled(): boolean {
  return LEVEL !== 'off' && operational
}

export function level(): MessageLogLevel {
  return LEVEL
}

/**
 * Samarkan nomor/JID: sisakan awalan dan akhiran secukupnya untuk mencocokkan
 * kontak, sembunyikan sisanya. "6281234567890@s.whatsapp.net" -> "6281****7890".
 */
export function maskPeer(peer: string | undefined): string | undefined {
  if (!peer) return peer
  const digits = peer.split('@')[0].replace(/\D/g, '')
  if (digits.length <= 8) return `${digits.slice(0, 2)}****`
  return `${digits.slice(0, 4)}****${digits.slice(-4)}`
}

/**
 * Tulis satu entri. Fire-and-forget: pemanggil tidak perlu menunggu dan tidak
 * akan pernah menerima error dari sini.
 */
export function append(entry: MessageLogEntry): void {
  if (!isEnabled()) return
  try {
    const today = dayKey()
    if (today !== streamDay) rotate(today)
    if (!stream) return

    if (MAX_BYTES > 0 && bytesToday >= MAX_BYTES) {
      if (!sizeWarned) {
        sizeWarned = true
        console.warn(
          `[message-log] ${streamDay}.jsonl melewati MESSAGE_LOG_MAX_BYTES; pencatatan dihentikan sampai hari berganti`,
        )
      }
      return
    }

    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        ...entry,
        peer: maskPeer(entry.peer),
        // Isi pesan hanya ikut pada level "full"; pada "meta" dibuang sama
        // sekali agar log tidak menjadi salinan percakapan.
        content: LEVEL === 'full' ? entry.content : undefined,
      }) + '\n'

    bytesToday += Buffer.byteLength(line)
    stream.write(line)
  } catch (err) {
    degrade(err)
  }
}

function rotate(today: string): void {
  stream?.end()
  mkdirSync(DIR, { recursive: true })
  const path = `${DIR}/${today}.jsonl`

  // Lanjutkan dari ukuran file yang sudah ada supaya restart di tengah hari
  // tidak mengulang hitungan dari nol.
  try {
    bytesToday = statSync(path).size
  } catch {
    bytesToday = 0
  }

  stream = createWriteStream(path, { flags: 'a' })
  stream.on('error', degrade)
  streamDay = today
  sizeWarned = false
  pruneOldFiles(today)
}

/** Hapus file log yang lebih tua dari MESSAGE_LOG_RETENTION_DAYS. */
function pruneOldFiles(today: string): void {
  if (RETENTION_DAYS <= 0) return
  const cutoff = Date.parse(today) - RETENTION_DAYS * 86_400_000
  if (!Number.isFinite(cutoff)) return
  try {
    for (const name of readdirSync(DIR)) {
      if (!FILE_RE.test(name)) continue
      const at = Date.parse(name.slice(0, 10))
      // <= agar RETENTION_DAYS=7 menyisakan tepat 7 file (hari ini s/d 6 hari
      // lalu), bukan 8.
      if (Number.isFinite(at) && at <= cutoff) unlinkSync(`${DIR}/${name}`)
    }
  } catch (err) {
    console.warn('[message-log] gagal membersihkan log lama:', err)
  }
}

function degrade(err: unknown): void {
  if (!operational) return
  operational = false
  console.warn('[message-log] pencatatan dinonaktifkan setelah kegagalan tulis:', err)
  try {
    stream?.end()
  } catch {
    // sudah gagal; tidak ada yang bisa dilakukan
  }
  stream = undefined
}
