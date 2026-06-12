import wa from '../wa.js'
import {
  assertWarmedUp,
  assertWithinRateLimit,
  RecipientNotFoundError,
  randomInt,
  envNum,
} from './session-guard.js'

const TYPING_MIN_MS = envNum('SEND_TYPING_MIN_MS', 800)
const TYPING_MAX_MS = envNum('SEND_TYPING_MAX_MS', 2500)

export interface PreSendOptions {
  sessionId: string
  to: string
  isGroup?: boolean
}

/**
 * Validasi pra-kirim. Melempar guard error (dipetakan ke status HTTP di
 * app.onError) bila:
 *  - sesi masih dalam masa warm-up,
 *  - batas laju per sesi terlampaui,
 *  - nomor tujuan tidak terdaftar di WhatsApp (khusus kontak personal).
 */
export async function assertCanSend(opts: PreSendOptions): Promise<void> {
  assertWarmedUp(opts.sessionId)

  // Mengirim ke nomor yang tidak terdaftar adalah salah satu sinyal spam
  // terkuat. Grup tidak divalidasi lewat onWhatsApp, jadi dilewati.
  if (!opts.isGroup) {
    const exists = await wa.isExist({
      sessionId: opts.sessionId,
      to: opts.to,
      isGroup: false,
    })
    if (!exists) throw new RecipientNotFoundError(opts.to)
  }

  // Catat slot rate-limit paling akhir, hanya bila pra-cek lain lolos — agar
  // probe ke sesi yang belum siap / nomor tidak ada tidak menghabiskan kuota.
  assertWithinRateLimit(opts.sessionId)
}

/**
 * Tampilkan indikator "mengetik" sebelum mengirim agar pola pengiriman lebih
 * menyerupai manusia. Pemanggilan ini blocking selama durasi acak, sekaligus
 * menjadi jeda anti-burst. Best-effort: kegagalan indikator tidak boleh
 * menggagalkan pengiriman pesan.
 */
export async function simulateTyping(opts: PreSendOptions): Promise<void> {
  try {
    await wa.sendTypingIndicator({
      sessionId: opts.sessionId,
      to: opts.to,
      duration: randomInt(TYPING_MIN_MS, TYPING_MAX_MS),
      isGroup: opts.isGroup,
    })
  } catch (err) {
    console.warn(
      `[typing] indikator mengetik gagal untuk ${opts.to}:`,
      err instanceof Error ? err.message : err,
    )
  }
}
