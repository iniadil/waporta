export class RetriesExhaustedError extends Error {
  constructor(
    public readonly originalError: Error,
    public readonly attempts: number
  ) {
    super(`All ${attempts} attempts failed: ${originalError.message}`)
    this.name = 'RetriesExhaustedError'
  }
}

export interface RetryOptions {
  maxRetries: number
  baseDelay: number
  isRetryable: (err: unknown) => boolean
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  let lastError: Error = new Error('No attempts made')

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (!opts.isRetryable(err)) {
        throw lastError
      }

      console.log(
        `[retry] attempt ${attempt}/${opts.maxRetries} failed: ${lastError.message}`
      )

      if (attempt < opts.maxRetries) {
        // Exponential backoff + jitter acak agar percobaan ulang tidak
        // sinkron (burst) saat banyak permintaan gagal bersamaan.
        const backoff = opts.baseDelay * Math.pow(2, attempt - 1)
        const jitter = Math.random() * opts.baseDelay
        await new Promise((r) => setTimeout(r, backoff + jitter))
      }
    }
  }

  throw new RetriesExhaustedError(lastError, opts.maxRetries)
}

// Hanya error jaringan transien murni yang aman dicoba ulang. Sinyal yang
// menandakan koneksi diputus oleh WhatsApp ('disconnected', 'connection
// closed', 'socket hang up') sengaja TIDAK di-retry: mengirim ulang pesan ke
// koneksi yang baru saja diputus menyerupai hammering dan dapat memperdalam
// pemblokiran. Koneksi yang putus harus dipulihkan dulu lewat reconnect.
const RETRYABLE_PATTERNS = [
  'timeout',
  'etimedout',
  'econnreset',
]

const NON_RETRYABLE_PATTERNS = ['not exist', 'invalid media', 'validation']

export function isRetryableWaError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()

  for (const pattern of NON_RETRYABLE_PATTERNS) {
    if (msg.includes(pattern)) return false
  }

  for (const pattern of RETRYABLE_PATTERNS) {
    if (msg.includes(pattern)) return true
  }

  return false
}
