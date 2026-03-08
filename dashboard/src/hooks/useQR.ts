import { useState, useEffect, useRef } from 'react'
import { getQR } from '../api/sessions'

export function useQR(sessionId: string | null, connected: boolean) {
  const [qr, setQR] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!sessionId || connected) {
      setQR(null)
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    const poll = async () => {
      try {
        const data = await getQR(sessionId)
        setQR(data.qr)
      } catch {
        // silently ignore poll errors
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 2000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sessionId, connected])

  return qr
}
