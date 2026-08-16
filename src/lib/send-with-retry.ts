import { withRetry, isRetryableWaError, RetriesExhaustedError } from './retry.js'
import { registry, type FailureDetails } from './notifier.js'
import { simulateTyping } from './send-guard.js'
import { envNum } from './session-guard.js'
import * as messageLog from './message-log.js'

type MessageType = 'text' | 'image' | 'document'

interface SendOptions<T> {
  sessionId: string
  to: string
  isGroup?: boolean
  messageType: MessageType
  sendFn: () => Promise<T>
}

const MAX_RETRIES = envNum('SEND_MAX_RETRIES', 3)
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
