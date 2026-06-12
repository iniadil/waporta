/**
 * Pelindung sesi untuk menurunkan risiko pemblokiran nomor oleh WhatsApp.
 *
 * Menyediakan dua hal yang tidak bergantung pada koneksi WhatsApp:
 *  - Warm-up: menolak pengiriman dalam beberapa menit pertama setelah sebuah
 *    sesi tersambung/tersambung-ulang. Mengirim secara burst tepat setelah
 *    pairing atau reconnect adalah pemicu ban yang kuat untuk nomor baru.
 *  - Rate limit: membatasi jumlah pesan per sesi dalam satu jendela waktu.
 *
 * State disimpan in-memory per proses — cukup untuk satu instance gateway.
 */

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

const WARMUP_MS = envNum('SEND_WARMUP_MS', 5 * 60_000)
const RATE_MAX = envNum('SEND_RATE_MAX', 20)
const RATE_WINDOW_MS = envNum('SEND_RATE_WINDOW_MS', 60_000)

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

const connectedAt = new Map<string, number>()
const sendTimestamps = new Map<string, number[]>()

export function markConnected(sessionId: string) {
  connectedAt.set(sessionId, Date.now())
}

export function markDisconnected(sessionId: string) {
  connectedAt.delete(sessionId)
  sendTimestamps.delete(sessionId)
}

/** Lempar bila sesi masih dalam masa warm-up sejak tersambung. */
export function assertWarmedUp(sessionId: string) {
  if (WARMUP_MS <= 0) return
  const since = connectedAt.get(sessionId)
  // Sesi yang tak terlacak (belum memicu onConnected) tidak diblokir.
  if (since === undefined) return
  const age = Date.now() - since
  if (age < WARMUP_MS) {
    throw new SessionWarmingUpError(sessionId, WARMUP_MS - age)
  }
}

/** Lempar bila sesi melampaui batas laju; mencatat slot baru bila lolos. */
export function assertWithinRateLimit(sessionId: string) {
  if (RATE_MAX <= 0) return
  const now = Date.now()
  const recent = (sendTimestamps.get(sessionId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  )
  if (recent.length >= RATE_MAX) {
    const retryAfterMs = RATE_WINDOW_MS - (now - recent[0])
    sendTimestamps.set(sessionId, recent)
    throw new RateLimitExceededError(sessionId, retryAfterMs)
  }
  recent.push(now)
  sendTimestamps.set(sessionId, recent)
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
