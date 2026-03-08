const sessionQRs = new Map<string, string>()
let pendingQRSession: string | null = null

export function setPendingSession(id: string) {
  pendingQRSession = id
}

export function onQR(qr: string) {
  if (pendingQRSession) {
    sessionQRs.set(pendingQRSession, qr)
  }
}

export function getQR(id: string): string | null {
  return sessionQRs.get(id) ?? null
}

export function clearQR(id: string) {
  sessionQRs.delete(id)
}
