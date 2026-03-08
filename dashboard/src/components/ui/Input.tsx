import React from 'react'
import { Field, Label, Input as HInput, Description } from '@headlessui/react'

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  description?: string
}

export function Input({ label, description, style, ...props }: Props) {
  return (
    <Field style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <Label style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
          {label}
        </Label>
      )}
      <HInput
        style={{
          width: '100%',
          background: 'var(--bg)',
          border: '1px solid var(--border-bright)',
          color: 'var(--text-bright)',
          padding: '6px 10px',
          fontSize: 13,
          fontFamily: 'IBM Plex Mono, monospace',
          outline: 'none',
          ...style,
        }}
        {...props}
      />
      {description && (
        <Description style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {description}
        </Description>
      )}
    </Field>
  )
}
