import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'fs'
import type { WebhookUrlRecord, WebhookUrlStoreFile } from './types.js'

const DIR = 'data'
const FILE = `${DIR}/webhook_urls.json`
const TMP = `${FILE}.tmp`

export class WebhookUrlStore {
  private records: WebhookUrlRecord[] = []
  private operational = true
  private tail: Promise<unknown> = Promise.resolve()
  private loaded = false

  init(): void {
    if (this.loaded) return
    this.loaded = true
    mkdirSync(DIR, { recursive: true })
    try {
      const raw = readFileSync(FILE, 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      // accept both versioned { version: 1, records } and legacy plain array
      if (Array.isArray(parsed)) {
        this.records = parsed as WebhookUrlRecord[]
      } else if (parsed && typeof parsed === 'object' && 'records' in parsed) {
        this.records = (parsed as WebhookUrlStoreFile).records
      } else {
        throw new Error('unrecognized store format')
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.records = []
      } else {
        console.error('[webhook-store] failed to load store:', err)
        this.operational = false
        this.records = []
      }
    }
  }

  isOperational(): boolean {
    return this.operational
  }

  snapshot(): WebhookUrlRecord[] {
    return [...this.records]
  }

  mutate<T>(fn: (records: WebhookUrlRecord[]) => { records: WebhookUrlRecord[]; result: T }): Promise<T> {
    const p = this.tail.then(
      () => this._runMutation(fn),
      () => this._runMutation(fn), // keep queue flowing even if prev op failed
    )
    // swallow errors on the chain tail so subsequent ops aren't blocked
    this.tail = p.catch(() => undefined)
    return p
  }

  private _runMutation<T>(fn: (records: WebhookUrlRecord[]) => { records: WebhookUrlRecord[]; result: T }): T {
    const prev = [...this.records]
    const outcome = fn([...this.records]) // may throw (e.g. duplicate) — let it propagate
    try {
      const file: WebhookUrlStoreFile = { version: 1, records: outcome.records }
      writeFileSync(TMP, JSON.stringify(file, null, 2), 'utf-8')
      renameSync(TMP, FILE)
    } catch (err) {
      this.records = prev
      throw err
    }
    this.records = outcome.records
    return outcome.result
  }
}
