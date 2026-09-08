import { forwardRef, type SelectHTMLAttributes } from 'react'

import { cn } from '../lib/utils'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-9 w-full appearance-none rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface-elevated)] px-3 pr-8 text-sm text-primary transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--background)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'bg-[image:linear-gradient(45deg,transparent_50%,currentColor_50%),linear-gradient(135deg,currentColor_50%,transparent_50%)] bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-15px)_calc(50%-2px),calc(100%-10px)_calc(50%-2px)] bg-no-repeat',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)
Select.displayName = 'Select'
