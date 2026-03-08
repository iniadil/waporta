import React from 'react'
import { Button as HButton } from '@headlessui/react'

interface Props {
  variant?: 'primary' | 'danger' | 'ghost'
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  style?: React.CSSProperties
  type?: 'button' | 'submit' | 'reset'
}

export function Button({ variant = 'primary', children, style, ...props }: Props) {
  const variants: Record<string, React.CSSProperties> = {
    primary: { borderColor: 'var(--amber)', color: 'var(--amber)' },
    danger: { borderColor: 'var(--red)', color: 'var(--red)' },
    ghost: { borderColor: 'var(--border-bright)', color: 'var(--text-dim)' },
  }

  return (
    <HButton
      style={{
        padding: '5px 12px',
        border: '1px solid',
        fontSize: 12,
        letterSpacing: '0.05em',
        transition: 'all 0.15s',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.4 : 1,
        fontFamily: 'IBM Plex Mono, monospace',
        background: 'none',
        ...variants[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </HButton>
  )
}
