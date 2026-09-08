import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export type BackLinkProps = {
  href: string
  label: string
}

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  )
}
