'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@doscientos/ui'
import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = {
  id: string
  title: string
  description?: string
  titleIcon?: ReactNode
  headerAside?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

/** Keeps secondary lead data available without making the page a wall of cards. */
export function LeadDetailDisclosure({
  id,
  title,
  description,
  titleIcon,
  headerAside,
  action,
  children,
  className,
  contentClassName,
}: Props) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <Accordion allowsMultipleExpanded={false}>
        <AccordionItem id={id} className="border-b-0">
          <CardHeader className="border-border/70 bg-muted/10 flex-row items-center gap-3 space-y-0 border-b">
            <AccordionTrigger className="min-w-0 flex-1 px-0 py-0 hover:bg-transparent aria-expanded:bg-transparent">
              <span className="flex min-w-0 flex-col gap-1 text-left">
                <span className="flex items-center gap-2 text-base font-semibold">
                  {titleIcon}
                  {title}
                </span>
                {description ? (
                  <span className="text-muted-foreground text-xs font-normal">{description}</span>
                ) : null}
              </span>
            </AccordionTrigger>
            {headerAside}
            {action}
          </CardHeader>
          <AccordionContent className="border-border border-t p-0">
            <CardContent className={contentClassName}>{children}</CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  )
}
