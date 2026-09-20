'use client'

import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Columns3,
  ReceiptText,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { cn } from '@/lib/utils'

const STEPS = [
  {
    label: 'Captar',
    title: 'Cada oportunidad encuentra su sitio',
    description: 'Leads, origen, responsable y siguiente acción en un pipeline que todo el equipo entiende.',
    metric: '5 leads activos',
    href: '/leads',
    icon: UsersRound,
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Convertir',
    title: 'De la conversación a una propuesta clara',
    description: 'Relaciona clientes, proyectos y propuestas para que el contexto nunca se pierda.',
    metric: '3 propuestas abiertas',
    href: '/proposals',
    icon: Columns3,
    color: 'text-violet-600 dark:text-violet-400',
  },
  {
    label: 'Cobrar',
    title: 'Facturación que da tranquilidad',
    description: 'Emite, consulta vencimientos y entiende el estado del negocio sin hojas de cálculo.',
    metric: '€11.000 por cobrar',
    href: '/invoices',
    icon: ReceiptText,
    color: 'text-emerald-600 dark:text-emerald-400',
  },
] as const

export function DemoWelcome() {
  const [activeStep, setActiveStep] = useState(0)
  const step = STEPS[activeStep]
  const Icon = step.icon

  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-[linear-gradient(120deg,rgba(42,66,39,0.12),rgba(189,255,123,0.12)_48%,rgba(255,255,255,0.7))] p-5 shadow-sm sm:p-7 dark:bg-[linear-gradient(120deg,rgba(42,66,39,0.38),rgba(189,255,123,0.08)_48%,rgba(255,255,255,0.03))]">
      <div className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative grid gap-7 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/75 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm">
            <ShieldCheck className="size-3.5" />
            Entorno de demostración · datos ficticios
          </div>
          <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Todo el negocio, de la oportunidad al cobro.
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6 sm:text-base">
            Una vista pensada para tomar decisiones rápido: qué merece atención, cuánto hay en juego y cuál es el siguiente paso.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/leads"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors"
            >
              Ver el recorrido completo <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/clients"
              className="border-border bg-background/75 hover:bg-background inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors"
            >
              Explorar contactos
            </Link>
          </div>
        </div>

        <div className="border-border/70 bg-background/75 rounded-2xl border p-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between px-2 pb-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Tu flujo</p>
              <p className="text-muted-foreground mt-1 text-xs">Un sistema que acompaña cada etapa</p>
            </div>
            <CircleDollarSign className="size-5 text-primary" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {STEPS.map((item, index) => {
              const ItemIcon = item.icon
              const selected = index === activeStep
              return (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActiveStep(index)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-all',
                    selected
                      ? 'border-primary/35 bg-primary/8 shadow-sm'
                      : 'border-transparent hover:border-border hover:bg-muted/60',
                  )}
                >
                  <ItemIcon className={cn('mb-3 size-4', item.color)} />
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="text-muted-foreground mt-1 block text-xs leading-5">{item.metric}</span>
                </button>
              )
            })}
          </div>
          <div className="border-border/70 mt-3 flex items-start gap-3 border-t px-2 pt-3">
            <div className="bg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Icon className={cn('size-4', step.color)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{step.title}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">{step.description}</p>
            </div>
            <Link href={step.href} aria-label={`Abrir módulo ${step.label}`} className="text-primary mt-1 shrink-0 rounded-md p-1 hover:bg-primary/10">
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <p className="text-muted-foreground mt-3 flex items-center gap-1.5 px-2 text-[11px]">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            Sin conexiones externas: todo lo que ves está preparado para la demo.
          </p>
        </div>
      </div>
    </section>
  )
}