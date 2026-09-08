import { type LabelHTMLAttributes, type ReactNode, useId } from 'react'

import { cn } from '../lib/utils'

export type FormFieldProps = {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FormFieldProps) {
  const reactId = useId()
  const id = htmlFor ?? reactId
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <FormLabel htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-[color:var(--danger)]">*</span> : null}
      </FormLabel>
      {children}
      {error ? (
        <p className="text-xs text-[color:var(--danger)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-[color:var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  )
}

function FormLabel({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is always passed via props by FormField
    <label
      className={cn('text-xs font-medium text-[color:var(--text-secondary)]', className)}
      {...props}
    >
      {children}
    </label>
  )
}
