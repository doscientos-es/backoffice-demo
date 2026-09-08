import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type MyDayColumnProps = {
  icon: ReactNode
  title: string
  count: number
  href: string
  empty: ReactNode
  children: ReactNode
}

export function MyDayColumn({ icon, title, count, href, empty, children }: MyDayColumnProps) {
  return (
    <Card className="border-border/80 bg-card/90 flex flex-col shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="border-border/60 bg-muted/20 flex-row items-center justify-between gap-2 space-y-0 border-b">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon} {title}
          {count > 0 ? <Badge variant="neutral">{count}</Badge> : null}
        </CardTitle>
        <Link
          href={href}
          className="text-muted-foreground hover:bg-background hover:text-primary inline-flex items-center rounded-md px-1.5 py-1 text-xs transition-colors"
        >
          Ver todos <ChevronRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1">
        {count === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm text-balance">{empty}</p>
        ) : (
          <ul className="divide-border flex flex-col divide-y [&>li]:py-2.5 first:[&>li]:pt-0 last:[&>li]:pb-0">
            {children}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
