import React from 'react'

type Status = 'connected' | 'connecting' | 'unknown'

interface Props {
  status: Status
}

const labels: Record<Status, string> = {
  connected: 'CONNECTED',
  connecting: 'CONNECTING',
  unknown: 'UNKNOWN',
}

export function StatusBadge({ status }: Props) {
  const styles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.08em',
    color: status === 'connected' ? 'var(--green)' : status === 'connecting' ? 'var(--amber)' : 'var(--text-dim)',
  }

  const dotStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: status === 'connected' ? 'var(--green)' : status === 'connecting' ? 'var(--amber)' : 'var(--text-dim)',
    flexShrink: 0,
  }

  return (
    <span style={styles}>
      <span
        style={dotStyle}
        className={status === 'connected' ? 'pulse-green' : ''}
      />
      {labels[status]}
    </span>
  )
}
