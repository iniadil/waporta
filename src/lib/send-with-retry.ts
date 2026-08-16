import { withRetry, isRetryableWaError, RetriesExhaustedError } from './retry.js'
import { registry, type FailureDetails } from './notifier.js'
import { simulateTyping } from './send-guard.js'
import { envNum, recordSend } from './session-guard.js'
import * as messageLog from './message-log.js'

type MessageType = 'text' | 'image' | 'document'

interface SendOptions<T> {
  sessionId: string
  to: string
  isGroup?: boolean
  messageType: MessageType
  sendFn: () => Promise<T>
}

// Nilainya adalah jumlah PERCOBAAN, bukan jumlah pengulangan, jadi 0 tidak
// berarti "jangan retry" melainkan "jangan kirim sama sekali" — withRetry akan
// melewati seluruh loop dan setiap pengiriman gagal dengan 502. Karena
// SEND_MAX_RETRIES=0 adalah cara paling wajar menuliskan "tanpa retry",
// nilainya dinaikkan ke 1: sekali kirim, tanpa pengulangan.
const MAX_RETRIES = Math.max(1, envNum('SEND_MAX_RETRIES', 3))
const BASE_DELAY = envNum('SEND_RETRY_BASE_DELAY_MS', 3000)

/**
 * Kirim dengan indikator mengetik, retry terbatas, dan notifikasi kegagalan.
 *
 * Mengembalikan hasil `sendFn` apa adanya — pemanggil membutuhkannya untuk
 * mengambil `key.id`, satu-satunya penghubung antara permintaan HTTP dan event
 * status pengiriman yang datang belakangan dari WhatsApp.
 */
export async function sendWithRetry<T>(opts: SendOptions<T>): Promise<T> {
  // Indikator "mengetik" sebelum mengirim — sekaligus jeda anti-burst.
  await simulateTyping({
    sessionId: opts.sessionId,
    to: opts.to,
    isGroup: opts.isGroup,
  })
  try {
    return await withRetry(opts.sendFn, {
      maxRetries: MAX_RETRIES,
      baseDelay: BASE_DELAY,
      isRetryable: isRetryableWaError,
      // assertCanSend hanya mencatat satu slot untuk satu permintaan HTTP,
      // padahal setiap retry adalah pengiriman nyata tambahan ke WhatsApp.
      // Tanpa pencatatan di sini, SEND_RATE_MAX=20 bisa berujung 60 percobaan
      // kirim dalam satu jendela — burst yang justru hendak dicegah.
      onRetry: () => recordSend(opts.sessionId),
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const attempts =
      err instanceof RetriesExhaustedError ? err.attempts : 1

    const details: FailureDetails = {
      kind: 'send',
      sessionId: opts.sessionId,
      to: opts.to,
      messageType: opts.messageType,
      error: errorMessage,
      attempts,
      timestamp: new Date().toISOString(),
    }

    // Fire-and-forget notification
    registry.notifyAll(details).catch(() => {})

    messageLog.append({
      event: 'send.error',
      sessionId: opts.sessionId,
      peer: opts.to,
      messageType: opts.messageType,
      error: errorMessage,
    })

    console.error(
      `[send] ${opts.messageType} to ${opts.to} via ${opts.sessionId} failed after ${attempts} attempt(s): ${errorMessage}`
    )

    throw err
  }
}

export { RetriesExhaustedError }
