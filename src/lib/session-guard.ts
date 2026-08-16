/**
 * Pelindung sesi untuk menurunkan risiko pemblokiran nomor oleh WhatsApp.
 *
 * Menyediakan empat hal:
 *  - Warm-up dua tingkat: nomor yang baru pertama kali di-pair menunggu jauh
 *    lebih lama daripada sesi matang yang sekadar tersambung ulang. Mengirim
 *    tepat setelah pairing adalah pemicu ban terkuat untuk nomor mentah,
 *    sementara reconnect pada nomor yang sudah lama dipakai hampir tidak
 *    berisiko — memperlakukan keduanya sama berarti menghukum yang salah.
 *  - Rate limit per jendela pendek: membatasi burst.
 *  - Kuota harian bertahap: hanya berlaku untuk sesi baru, melonggar seiring
 *    umur sesi. Sesi yang sudah ada sebelum fitur ini tidak terkena.
 *  - Penolakan sesi yang diblokir WhatsApp.
 *
 * Warm-up dan rate limit disimpan in-memory per proses. Umur sesi dan kuota
 * harian dipersistensi lewat session-health-store.ts supaya restart proses tidak
 * membuat guard kehilangan ingatan.
 */
import { sessionHealth } from './session-health-store.js'

/**
 * Baca env numerik dengan aman. Nilai non-numerik/negatif TIDAK boleh
 * menonaktifkan guard secara diam-diam (mis. SEND_RATE_MAX=NaN), jadi kita
 * jatuh ke default yang aman sambil memberi peringatan.
 */
export function envNum(name: string, def: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return def
  const v = Number(raw)
  if (!Number.isFinite(v) || v < 0) {
    console.warn(`[guard] env ${name}="${raw}" tidak valid; memakai default ${def}`)
    return def
  }
  return v
}

// SEND_WARMUP_MS adalah env lama yang sudah terdokumentasi. Bila pengguna
// menyetelnya secara eksplisit — termasuk ke 0 untuk mematikan warm-up — nilai
// itu tetap dihormati sebagai default kedua tingkat, sehingga konfigurasi yang
// sudah berjalan tidak berubah perilakunya.
const LEGACY_WARMUP_SET =
  process.env.SEND_WARMUP_MS !== undefined && process.env.SEND_WARMUP_MS !== ''
const LEGACY_WARMUP_MS = envNum('SEND_WARMUP_MS', 5 * 60_000)

const WARMUP_COLD_MS = envNum(
  'SEND_WARMUP_COLD_MS',
  LEGACY_WARMUP_SET ? LEGACY_WARMUP_MS : 30 * 60_000,
)
const WARMUP_RECONNECT_MS = envNum(
  'SEND_WARMUP_RECONNECT_MS',
  LEGACY_WARMUP_SET ? LEGACY_WARMUP_MS : 60_000,
)

const RATE_MAX = envNum('SEND_RATE_MAX', 20)
const RATE_WINDOW_MS = envNum('SEND_RATE_WINDOW_MS', 60_000)

/**
 * Kuota harian per umur sesi: elemen ke-N adalah batas untuk hari ke-N sejak
 * sesi pertama tersambung. Di luar panjang daftar, tidak ada batas harian.
 * "0" mematikan ramp-up.
 *
 * Nilai kosong diperlakukan sebagai "tidak disetel" — sama seperti envNum —
 * karena docker-compose meneruskan variabel yang tidak diisi sebagai string
 * kosong, dan itu tidak boleh diam-diam mematikan perlindungan.
 */
function readRampup(): number[] {
  const fallback = [20, 50, 100, 200]
  const raw = process.env.SEND_RAMPUP_DAILY
  if (raw === undefined || raw.trim() === '') return fallback
  const trimmed = raw.trim()
  if (trimmed === '0') return []
  const parts = trimmed.split(',').map((s) => Number(s.trim()))
  if (parts.some((n) => !Number.isFinite(n) || n <= 0)) {
    console.warn(
      `[guard] env SEND_RAMPUP_DAILY="${raw}" tidak valid; memakai default ${fallback.join(',')}`,
    )
    return fallback
  }
  return parts
}

const RAMPUP_DAILY = readRampup()

export class SessionWarmingUpError extends Error {
  constructor(
    public readonly sessionId: string,
    public readonly remainingMs: number,
  ) {
    super(
      `Session "${sessionId}" is still warming up; wait ${Math.ceil(remainingMs / 1000)}s before sending`,
    )
    this.name = 'SessionWarmingUpError'
  }
}

export class RateLimitExceededError extends Error {
  constructor(
    public readonly sessionId: string,
    public readonly retryAfterMs: number,
  ) {
    super(
      `Rate limit exceeded for session "${sessionId}"; retry after ${Math.ceil(retryAfterMs / 1000)}s`,
    )
    this.name = 'RateLimitExceededError'
  }
}

export class RecipientNotFoundError extends Error {
  constructor(public readonly to: string) {
    super(`Recipient "${to}" is not registered on WhatsApp`)
    this.name = 'RecipientNotFoundError'
  }
}

/**
 * Dipisahkan dari RateLimitExceededError karena konsekuensinya jauh berbeda:
 * rate limit pulih dalam hitungan detik, kuota harian baru pulih tengah malam.
 * Klien yang menghormati retryAfterMs perlu tahu bedanya sebelum tidur berjam-jam.
 */
export class DailyQuotaExceededError extends Error {
  constructor(
    public readonly sessionId: string,
    public readonly limit: number,
    public readonly retryAfterMs: number,
  ) {
    super(
      `Daily quota of ${limit} message(s) reached for session "${sessionId}"; the session is still ramping up. Resets at midnight.`,
    )
    this.name = 'DailyQuotaExceededError'
  }
}

export class SessionBannedError extends Error {
  constructor(public readonly sessionId: string) {
    super(
      `Session "${sessionId}" was rejected by WhatsApp; the number appears to be blocked. Re-pair with a different number.`,
    )
    this.name = 'SessionBannedError'
  }
}

interface WarmupState {
  since: number
  /** Ambang yang berlaku untuk koneksi ini — beda antara pairing baru dan reconnect. */
  thresholdMs: number
}

const warmup = new Map<string, WarmupState>()
const sendTimestamps = new Map<string, number[]>()

/**
 * Catat sesi tersambung. `isCold` menandakan ini pairing pertama kali (belum ada
 * riwayat di session-health-store), yang mendapat warm-up jauh lebih panjang.
 * Default-nya sengaja `true`: pemanggil membaca status "cold" secara asinkron,
 * jadi selagi menunggu kita memilih sikap yang lebih aman.
 */
export function markConnected(sessionId: string, isCold = true) {
  warmup.set(sessionId, {
    since: Date.now(),
    thresholdMs: isCold ? WARMUP_COLD_MS : WARMUP_RECONNECT_MS,
  })
}

/**
 * Turunkan ambang warm-up sebuah sesi ke tingkat reconnect tanpa memulai ulang
 * hitungannya. Dipakai ketika status "sesi ini sudah matang" baru diketahui
 * setelah warm-up terlanjur dipasang secara konservatif.
 */
export function relaxWarmup(sessionId: string) {
  const state = warmup.get(sessionId)
  if (state === undefined) return
  state.thresholdMs = WARMUP_RECONNECT_MS
}

export function markDisconnected(sessionId: string) {
  warmup.delete(sessionId)
  sendTimestamps.delete(sessionId)
}

/** Lempar bila sesi masih dalam masa warm-up sejak tersambung. */
export function assertWarmedUp(sessionId: string) {
  const state = warmup.get(sessionId)
  // Sesi yang tak terlacak (belum memicu onConnected) tidak diblokir di sini —
  // pengiriman ke sesi yang belum siap tetap ditolak lapisan bawah dengan 503.
  if (state === undefined) return
  if (state.thresholdMs <= 0) return
  const age = Date.now() - state.since
  if (age < state.thresholdMs) {
    throw new SessionWarmingUpError(sessionId, state.thresholdMs - age)
  }
}

/** Lempar bila WhatsApp sudah menolak sesi ini (nomor kemungkinan diblokir). */
export function assertNotBanned(sessionId: string) {
  if (sessionHealth.isBanned(sessionId)) {
    throw new SessionBannedError(sessionId)
  }
}

/**
 * Kuota harian bertahap untuk sesi baru. Berjalan berdampingan dengan rate
 * limit per jendela pendek: keduanya independen, yang mana pun tercapai lebih
 * dulu akan menolak. Sesi tanpa riwayat umur (dibuat sebelum fitur ini ada)
 * dianggap matang dan dilewati.
 */
export function assertWithinDailyQuota(sessionId: string) {
  if (RAMPUP_DAILY.length === 0) return
  const day = sessionHealth.ageInDays(sessionId)
  if (day === undefined) return
  if (day > RAMPUP_DAILY.length) return

  const limit = RAMPUP_DAILY[day - 1]
  if (sessionHealth.sentToday(sessionId) >= limit) {
    throw new DailyQuotaExceededError(sessionId, limit, msUntilMidnight())
  }
}

/**
 * Pesan kuota setelah SEMUA guard lolos. Dipanggil sekali per pengiriman yang
 * benar-benar akan dicoba; sengaja mendahului pengiriman aktual agar permintaan
 * yang berjalan bersamaan tidak sama-sama lolos pemeriksaan.
 */
export function recordSend(sessionId: string) {
  if (RATE_MAX > 0) {
    const recent = sendTimestamps.get(sessionId) ?? []
    recent.push(Date.now())
    sendTimestamps.set(sessionId, recent)
  }
  sessionHealth.incrementSent(sessionId)
}

function msUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return midnight.getTime() - now.getTime()
}

/**
 * Lempar bila sesi melampaui batas laju. Hanya memeriksa — pencatatan slot
 * dilakukan terpisah lewat recordSend(), supaya permintaan yang ditolak oleh
 * guard LAIN tidak ikut menghabiskan jatah.
 */
export function assertWithinRateLimit(sessionId: string) {
  if (RATE_MAX <= 0) return
  const now = Date.now()
  const recent = (sendTimestamps.get(sessionId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  )
  sendTimestamps.set(sessionId, recent)
  if (recent.length >= RATE_MAX) {
    throw new RateLimitExceededError(sessionId, RATE_WINDOW_MS - (now - recent[0]))
  }
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
