/**
 * Catatan kesehatan sesi yang bertahan lintas restart.
 *
 * Guard anti-ban di session-guard.ts sepenuhnya in-memory, sehingga setiap
 * restart proses membuatnya amnesia: sesi lama yang sudah matang diperlakukan
 * sama dengan nomor yang baru saja di-pair. Store ini menyimpan fakta yang
 * tidak boleh hilang — kapan sebuah sesi pertama kali tersambung, nomor apa yang
 * dipakainya, dan berapa pesan yang sudah dikirim hari ini — supaya perlindungan
 * bisa diarahkan hanya ke nomor baru, bukan ke semua orang.
 *
 * Memori adalah sumber kebenaran; file JSON hanya cadangannya. Perubahan
 * diterapkan ke memori secara sinkron lalu ditulis lewat antrean serial dengan
 * pola .tmp + rename (atomik). Guard karenanya tetap menghitung dengan benar
 * walau disk sedang bermasalah.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'fs'

const DIR = 'data'
const FILE = `${DIR}/session_health.json`
const TMP = `${FILE}.tmp`

// Berapa hari riwayat kuota harian yang disimpan. Cukup beberapa hari; tujuannya
// menghitung kuota hari berjalan, bukan menyimpan statistik jangka panjang.
const SENT_HISTORY_DAYS = 3

// Umur yang diberikan kepada sesi yang diadopsi saat upgrade. Harus jauh lebih
// panjang dari tabel ramp-up mana pun agar sesi lama tidak pernah kena kuota.
const ADOPTED_AGE_DAYS = 400

export interface SessionHealthRecord {
  sessionId: string
  /**
   * ISO. Pembeda utama antara pairing pertama dan sekadar reconnect.
   * Kosong berarti sesi belum pernah benar-benar tersambung — record-nya dibuat
   * oleh peristiwa lain, mis. penolakan WhatsApp saat pairing.
   */
  firstConnectedAt?: string
  lastConnectedAt?: string
  /**
   * JID pemilik sesi. Dipakai mendeteksi sessionId yang dipakai ulang untuk
   * nomor yang berbeda — kasus di mana riwayat lama tidak boleh diwarisi.
   */
  jid?: string
  /** Kunci tanggal lokal "YYYY-MM-DD" -> jumlah pesan terkirim hari itu. */
  sentPerDay: Record<string, number>
  lastDisconnectCode?: number
  /** ISO. Terisi bila WhatsApp menolak sesi ini (statusCode 403). */
  bannedAt?: string
}

export interface SessionHealthStoreFile {
  version: 1
  /** ISO. Menandai bahwa adopsi sesi lama sudah dijalankan sekali. */
  adoptedAt?: string
  records: SessionHealthRecord[]
}

/** Kunci tanggal lokal — sengaja lokal agar "hari" mengikuti zona waktu server. */
export function dayKey(at: Date = new Date()): string {
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Selisih hari kalender antara dua kunci tanggal. */
function daysBetween(fromKey: string, toKey: string): number | undefined {
  const from = Date.parse(`${fromKey}T00:00:00`)
  const to = Date.parse(`${toKey}T00:00:00`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return undefined
  return Math.round((to - from) / 86_400_000)
}

export class SessionHealthStore {
  private records: SessionHealthRecord[] = []
  private operational = true
  private tail: Promise<void> = Promise.resolve()
  private loaded = false
  private adoptedAt: string | undefined
  /** True hanya pada proses pertama setelah fitur ini dipasang. */
  private needsAdoption = false

  init(): void {
    if (this.loaded) return
    this.loaded = true
    try {
      mkdirSync(DIR, { recursive: true })
      const raw = readFileSync(FILE, 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && 'records' in parsed) {
        const file = parsed as SessionHealthStoreFile
        this.records = file.records
        this.adoptedAt = file.adoptedAt
        this.needsAdoption = file.adoptedAt === undefined
      } else {
        throw new Error('unrecognized store format')
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // Belum ada file: instalasi baru ATAU upgrade dari versi tanpa fitur ini.
        // Keduanya dibedakan oleh adoptExisting().
        this.records = []
        this.needsAdoption = true
      } else {
        // Termasuk kegagalan mkdirSync (mis. filesystem read-only). Store turun
        // ke mode degradasi alih-alih menjatuhkan seluruh proses saat boot —
        // modul ini dievaluasi lewat rantai impor yang menyentuh hampir semua
        // jalur aplikasi.
        console.error('[session-health] gagal memuat store; berjalan tanpa persistensi:', err)
        this.operational = false
        this.records = []
      }
    }
  }

  isOperational(): boolean {
    return this.operational
  }

  /**
   * Baca sinkron dari salinan in-memory. Guard pengiriman berjalan di jalur
   * panas dan tidak boleh menunggu I/O, jadi pembacaan tidak pernah menyentuh
   * disk — hanya penulisan yang melakukannya.
   */
  get(sessionId: string): SessionHealthRecord | undefined {
    return this.records.find((r) => r.sessionId === sessionId)
  }

  /**
   * Tandai sesi-sesi yang sudah ada SEBELUM fitur ini dipasang sebagai matang.
   *
   * Tanpa ini, upgrade akan memperlakukan setiap sesi produksi yang sudah
   * berjalan berbulan-bulan sebagai nomor yang baru di-pair: warm-up 30 menit
   * plus kuota 20 pesan/hari. Adopsi hanya dijalankan sekali — ditandai oleh
   * `adoptedAt` di file — sehingga sesi yang dibuat setelahnya tetap mendapat
   * perlindungan penuh.
   *
   * Mengembalikan daftar sessionId yang diadopsi supaya pemanggil bisa
   * melonggarkan warm-up yang mungkin sudah terlanjur dipasang.
   */
  async adoptExisting(sessionIds: string[]): Promise<string[]> {
    if (!this.needsAdoption) return []
    this.needsAdoption = false

    const backdated = new Date(Date.now() - ADOPTED_AGE_DAYS * 86_400_000).toISOString()
    const adopted: string[] = []
    for (const sessionId of sessionIds) {
      const existing = this.get(sessionId)
      if (existing) {
        // Ditimpa tanpa syarat: autoLoad bisa menyambungkan sesi lebih dulu dan
        // menandainya baru di-pair beberapa detik sebelum adopsi selesai. Pada
        // proses pertama ini, apa pun yang sudah ada di daftar sesi tersimpan
        // menurut definisi mendahului fitur ini.
        existing.firstConnectedAt = backdated
        existing.sentPerDay = {}
      } else {
        this.records.push({ sessionId, firstConnectedAt: backdated, sentPerDay: {} })
      }
      adopted.push(sessionId)
    }

    this.adoptedAt = new Date().toISOString()
    if (adopted.length > 0) {
      console.log(
        `[session-health] ${adopted.length} sesi yang sudah ada ditandai matang: ${adopted.join(', ')}`,
      )
    }
    await this.persist()
    return adopted
  }

  /**
   * Tandai sesi tersambung. Mengembalikan `true` bila ini pertama kalinya sesi
   * benar-benar tersambung — pemanggil memakainya untuk memilih warm-up mana
   * yang berlaku. Koneksi yang berhasil juga membersihkan penanda ban.
   *
   * `jid` opsional; bila diberikan dan berbeda dari yang tersimpan, riwayat
   * lama dibuang. sessionId yang sama dipakai ulang untuk nomor lain berarti
   * nomor itu mentah dan tidak boleh mewarisi umur nomor sebelumnya.
   */
  async markConnected(sessionId: string, jid?: string): Promise<boolean> {
    const nowIso = new Date().toISOString()
    let record = this.get(sessionId)
    if (!record) {
      record = { sessionId, sentPerDay: {} }
      this.records.push(record)
    }

    if (jid && record.jid && normalizeJid(record.jid) !== normalizeJid(jid)) {
      delete record.firstConnectedAt
      record.sentPerDay = {}
    }

    const isCold = record.firstConnectedAt === undefined
    if (isCold) record.firstConnectedAt = nowIso
    if (jid) record.jid = jid
    record.lastConnectedAt = nowIso
    // Berhasil tersambung berarti nomor tidak lagi ditolak.
    delete record.bannedAt

    await this.persist()
    return isCold
  }

  /** Tandai sesi ditolak WhatsApp agar pengiriman berikutnya ditolak tegas. */
  async markBanned(sessionId: string, code: number): Promise<void> {
    const nowIso = new Date().toISOString()
    const existing = this.get(sessionId)
    if (existing) {
      existing.bannedAt = nowIso
      existing.lastDisconnectCode = code
    } else {
      // Sengaja tanpa firstConnectedAt: sesi ini belum pernah tersambung, jadi
      // pairing berikutnya harus tetap dihitung sebagai nomor baru.
      this.records.push({ sessionId, sentPerDay: {}, bannedAt: nowIso, lastDisconnectCode: code })
    }
    await this.persist()
  }

  isBanned(sessionId: string): boolean {
    return this.get(sessionId)?.bannedAt !== undefined
  }

  /** Jumlah pesan yang sudah tercatat hari ini (0 bila sesi belum dikenal). */
  sentToday(sessionId: string): number {
    return this.get(sessionId)?.sentPerDay[dayKey()] ?? 0
  }

  /**
   * Umur sesi dalam hari kalender, dihitung 1 pada hari sesi pertama tersambung.
   *
   * Sengaja memakai selisih tanggal kalender, bukan selisih 24 jam, supaya
   * konsisten dengan sentToday() yang juga berbasis tanggal. Kalau keduanya
   * berbeda, nomor yang di-pair menjelang tengah malam akan mendapat kuota
   * hari-1 dua kali dalam beberapa jam.
   *
   * Mengembalikan undefined bila sesi belum pernah tersambung atau tidak punya
   * record — sesi semacam itu tidak dikenai ramp-up.
   */
  ageInDays(sessionId: string): number | undefined {
    const first = this.get(sessionId)?.firstConnectedAt
    if (!first) return undefined
    const at = new Date(first)
    if (Number.isNaN(at.getTime())) return undefined
    const diff = daysBetween(dayKey(at), dayKey())
    if (diff === undefined) return undefined
    return diff + 1
  }

  /**
   * Naikkan penghitung harian. Perubahan diterapkan ke memori SECARA SINKRON,
   * baru kemudian ditulis ke disk. Ini penting: bila penghitung baru bertambah
   * setelah promise selesai, sekumpulan permintaan yang datang bersamaan akan
   * sama-sama membaca angka lama dan semuanya lolos — persis burst yang hendak
   * dicegah kuota ini.
   */
  incrementSent(sessionId: string): void {
    const existing = this.get(sessionId)
    if (!existing) return
    const key = dayKey()
    existing.sentPerDay[key] = (existing.sentPerDay[key] ?? 0) + 1
    pruneSentHistory(existing)
    void this.persist()
  }

  /**
   * Antrekan penulisan snapshot memori ke disk. Antrean menjaga penulisan tetap
   * serial; operasi tulisnya sendiri sinkron, yang dapat diterima karena isinya
   * hanya satu record per sesi.
   */
  private persist(): Promise<void> {
    if (!this.operational) return Promise.resolve()
    const p = this.tail.then(
      () => this.writeSnapshot(),
      () => this.writeSnapshot(), // jaga antrean tetap jalan walau tulis sebelumnya gagal
    )
    this.tail = p.catch((err) => {
      console.warn('[session-health] gagal menyimpan ke disk:', err)
    })
    return this.tail
  }

  private writeSnapshot(): void {
    const file: SessionHealthStoreFile = {
      version: 1,
      adoptedAt: this.adoptedAt,
      records: this.records,
    }
    writeFileSync(TMP, JSON.stringify(file, null, 2), 'utf-8')
    renameSync(TMP, FILE)
  }
}

/** Buang suffix perangkat/server agar "628…:12@s.whatsapp.net" == "628…@s.whatsapp.net". */
function normalizeJid(jid: string): string {
  return jid.split('@')[0].split(':')[0]
}

function pruneSentHistory(rec: SessionHealthRecord): void {
  const keys = Object.keys(rec.sentPerDay).sort()
  for (const key of keys.slice(0, Math.max(0, keys.length - SENT_HISTORY_DAYS))) {
    delete rec.sentPerDay[key]
  }
}

export const sessionHealth = new SessionHealthStore()
sessionHealth.init()
