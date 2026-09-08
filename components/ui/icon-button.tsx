import type * as React from 'react'

import { Button } from '@/primitives/ui/button'

export type IconButtonProps = React.ComponentProps<typeof Button> & {
  label: string
}

export function IconButton({ label, size = 'icon', ...props }: IconButtonProps) {
  return <Button {...props} size={size} aria-label={label} />
}
