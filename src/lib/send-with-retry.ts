import { withRetry, isRetryableWaError, RetriesExhaustedError } from './retry.js'
import { registry, type FailureDetails } from './notifier.js'

type MessageType = 'text' | 'image' | 'document'

interface SendOptions {
  sessionId: string
  to: string
  messageType: MessageType
  sendFn: () => Promise<unknown>
}

const MAX_RETRIES = 3
const BASE_DELAY = 1000

export async function sendWithRetry(opts: SendOptions): Promise<void> {
  try {
    await withRetry(opts.sendFn, {
      maxRetries: MAX_RETRIES,
      baseDelay: BASE_DELAY,
      isRetryable: isRetryableWaError,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const attempts =
      err instanceof RetriesExhaustedError ? err.attempts : 1

    const details: FailureDetails = {
      sessionId: opts.sessionId,
      to: opts.to,
      messageType: opts.messageType,
      error: errorMessage,
      attempts,
      timestamp: new Date().toISOString(),
    }

    // Fire-and-forget notification
    registry.notifyAll(details).catch(() => {})

    console.error(
      `[send] ${opts.messageType} to ${opts.to} via ${opts.sessionId} failed after ${attempts} attempt(s): ${errorMessage}`
    )

    throw err
  }
}

export { RetriesExhaustedError }
