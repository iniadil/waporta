const sessionQRs = new Map<string, string>()

export function setPendingSession(_id: string) {
  // no-op: sessionId now comes directly from onQRUpdated callback
}

export function onQR(sessionId: string, qr: string) {
  sessionQRs.set(sessionId, qr)
}

export function getQR(id: string): string | null {
  return sessionQRs.get(id) ?? null
}

export function clearQR(id: string) {
  sessionQRs.delete(id)
}
