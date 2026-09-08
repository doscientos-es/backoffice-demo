import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'

export type BreadcrumbEntry = {
  label: string
  href?: string
}

export type PageHeaderProps = {
  title: string
  /** Small contextual label rendered above the page title. */
  eyebrow?: ReactNode
  description?: string
  /** Optional secondary metadata rendered below the description. */
  meta?: ReactNode
  /** Optional icon/avatar rendered to the left of the title. */
  icon?: ReactNode
  back?: ReactNode
  breadcrumbs?: BreadcrumbEntry[]
  actions?: ReactNode
  titleClassName?: string
  className?: string
}

export function PageHeader({
  title,
  eyebrow,
  description,
  meta,
  icon,
  back,
  breadcrumbs,
  actions,
  titleClassName,
  className,
}: PageHeaderProps) {
  const hasCrumbs = breadcrumbs && breadcrumbs.length > 0
  return (
    <header className={cn('flex flex-col gap-2', className)}>
      {hasCrumbs ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((entry, i) => {
              const isLast = i === breadcrumbs.length - 1
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: breadcrumbs are a static, ordered trail
                <Fragment key={`${entry.label}:${i}`}>
                  <BreadcrumbItem>
                    {isLast || !entry.href ? (
                      <BreadcrumbPage className="max-w-[28ch] truncate">
                        {entry.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={entry.href} className="max-w-[20ch] truncate">
                          {entry.label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {isLast ? null : <BreadcrumbSeparator />}
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : back ? (
        <div className="text-sm">{back}</div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:flex-1">
          {icon ? <div className="shrink-0">{icon}</div> : null}
          <div className="min-w-0">
            {eyebrow ? (
              <div className="text-muted-foreground mb-0.5 text-sm font-medium">{eyebrow}</div>
            ) : null}
            <h1
              className={cn(
                'wrap-break-word text-2xl font-semibold tracking-tight text-foreground',
                titleClassName,
              )}
            >
              {title}
            </h1>
            {description ? (
              <p className="text-muted-foreground mt-1 text-sm">{description}</p>
            ) : null}
            {meta ? <div className="mt-2">{meta}</div> : null}
          </div>
        </div>
        {actions ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:max-w-1/2 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}
