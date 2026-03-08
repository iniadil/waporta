import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface Props {
  qr: string | null
}

export function QRDisplay({ qr }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!qr || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, qr, {
      width: 200,
      margin: 2,
      color: { dark: '#f5a623', light: '#0a0a0a' },
    })
  }, [qr])

  if (!qr) {
    return (
      <div style={{
        width: 204,
        height: 204,
        border: '1px solid var(--border-bright)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: 'var(--text-dim)',
        fontSize: 11,
      }}>
        <div style={{
          width: 20,
          height: 20,
          border: '2px solid var(--amber)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        WAITING FOR QR...
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        style={{
          border: '2px solid var(--amber)',
          display: 'block',
          animation: 'scanReveal 0.4s ease forwards',
        }}
      />
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}
