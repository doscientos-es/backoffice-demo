'use client'

/**
 * Barra de progreso fina (estilo NProgress) para navegaciones cliente en
 * Next.js App Router.
 *
 * Estrategia:
 * - Un listener de `click` en el documento detecta cuándo el usuario activa
 *   un <a> interno → arranca la barra y la anima con un intervalo.
 * - `usePathname` detecta cuándo la navegación termina → completa la barra
 *   y la desvanece.
 * - No depende de eventos del router (no disponibles en App Router) ni de
 *   librerías externas.
 */

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

export function NavProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const [width, setWidth] = useState(0)
  const prevPath = useRef(pathname)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cuando el pathname cambia → la navegación terminó.
  useEffect(() => {
    if (prevPath.current === pathname) return
    prevPath.current = pathname

    if (intervalRef.current) clearInterval(intervalRef.current)
    setWidth(100)
    doneTimerRef.current = setTimeout(() => {
      setActive(false)
      setWidth(0)
    }, 300)
  }, [pathname])

  useEffect(() => {
    function startProgress() {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
      setActive(true)
      setWidth(8)

      let w = 8
      intervalRef.current = setInterval(() => {
        // Easing asintótico: nunca llega al 90% sola.
        w = w + (90 - w) * 0.08
        setWidth(Math.min(w, 88))
      }, 120)
    }

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      const anchor = target.closest('a') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href) return
      // Ignorar: externas, fragmentos, mailto/tel, target="_blank"
      if (
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.target === '_blank'
      )
        return

      startProgress()
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
    }
  }, [])

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed left-0 top-0 z-[9999] h-[2px] bg-primary',
        'transition-[width] duration-100 ease-linear',
        active ? 'opacity-100' : 'opacity-0 transition-opacity duration-300',
      )}
      style={{ width: `${width}%` }}
    />
  )
}
