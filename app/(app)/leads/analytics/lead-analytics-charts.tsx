'use client'

import type { ECharts, EChartsOption } from 'echarts'
import { useTheme } from 'next-themes'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LeadJourneyAnalytics } from '@/lib/leads/analytics'

type ChartPalette = {
  background: string
  border: string
  foreground: string
  muted: string
  primary: string
  success: string
  danger: string
  info: string
}

const LIGHT_PALETTE: ChartPalette = {
  background: '#ffffff',
  border: '#d4d4d4',
  foreground: '#171717',
  muted: '#737373',
  primary: '#2a4227',
  success: '#16a34a',
  danger: '#dc2626',
  info: '#2563eb',
}

const DARK_PALETTE: ChartPalette = {
  background: '#343434',
  border: '#5a5a5a',
  foreground: '#fafafa',
  muted: '#b5b5b5',
  primary: '#e7e7e7',
  success: '#22c55e',
  danger: '#ef4444',
  info: '#3b82f6',
}

function useChartPalette(): ChartPalette {
  const { resolvedTheme } = useTheme()
  const [palette, setPalette] = useState(LIGHT_PALETTE)

  useEffect(() => {
    setPalette(resolvedTheme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE)
  }, [resolvedTheme])

  return palette
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}

function EChart({
  option,
  label,
  className,
}: {
  option: EChartsOption
  label: string
  className: string
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const optionRef = useRef(option)

  useEffect(() => {
    optionRef.current = option
    chartRef.current?.setOption(option, { notMerge: true, lazyUpdate: true })
  }, [option])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    let cancelled = false
    let resizeObserver: ResizeObserver | undefined
    void import('echarts').then(({ init }) => {
      if (cancelled) return
      const chart = init(element)
      chartRef.current = chart
      chart.setOption(optionRef.current, { notMerge: true })
      resizeObserver = new ResizeObserver(() => chart.resize())
      resizeObserver.observe(element)
    })

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  return <div ref={elementRef} role="img" aria-label={label} className={className} />
}

function tooltip(palette: ChartPalette) {
  return {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderWidth: 1,
    textStyle: { color: palette.foreground, fontSize: 12 },
    padding: [8, 10],
  }
}

export function LeadAnalyticsCharts({ analytics }: { analytics: LeadJourneyAnalytics }) {
  const palette = useChartPalette()
  const reducedMotion = useReducedMotion()
  const nodeLabels = useMemo(
    () => new Map(analytics.sankeyNodes.map((node) => [node.id, node.label])),
    [analytics.sankeyNodes],
  )

  const sankeyOption = useMemo<EChartsOption>(
    () => ({
      animation: !reducedMotion,
      animationDuration: 450,
      tooltip: {
        ...tooltip(palette),
        trigger: 'item',
        renderMode: 'richText',
        formatter: (rawParams) => {
          const params = (Array.isArray(rawParams) ? rawParams[0] : rawParams) as
            | { dataType?: string; name?: string; value?: number }
            | undefined
          if (!params) return ''
          if (params.dataType === 'edge') return `${params.value ?? 0} leads`
          const name = params.name ?? ''
          return `${nodeLabels.get(name) ?? name}\n${params.value ?? 0} leads`
        },
      },
      series: [
        {
          type: 'sankey',
          left: 8,
          right: 8,
          top: 12,
          bottom: 12,
          nodeAlign: 'justify',
          nodeGap: 14,
          nodeWidth: 12,
          draggable: false,
          data: analytics.sankeyNodes.map((node) => ({
            name: node.id,
            value: 0,
            itemStyle: { color: node.color, borderWidth: 0 },
          })),
          links: analytics.sankeyLinks,
          label: {
            color: palette.foreground,
            fontSize: 11,
            formatter: (params) => nodeLabels.get(params.name) ?? params.name,
          },
          lineStyle: { color: 'gradient', opacity: 0.34, curveness: 0.48 },
          emphasis: { focus: 'adjacency' },
        },
      ],
    }),
    [analytics.sankeyLinks, analytics.sankeyNodes, nodeLabels, palette, reducedMotion],
  )

  const funnelOption = useMemo<EChartsOption>(
    () => ({
      animation: !reducedMotion,
      animationDuration: 400,
      tooltip: {
        ...tooltip(palette),
        trigger: 'item',
        valueFormatter: (value) => `${value} leads`,
      },
      series: [
        {
          type: 'funnel',
          left: '8%',
          top: 12,
          bottom: 8,
          width: '84%',
          min: 0,
          max: analytics.total,
          minSize: '16%',
          maxSize: '100%',
          sort: 'none',
          gap: 3,
          label: {
            color: palette.foreground,
            fontSize: 11,
            formatter: (params) => {
              const rate = (params.data as { rate?: number }).rate ?? 0
              return `${params.name}  ${params.value} · ${rate.toFixed(0)}%`
            },
          },
          itemStyle: { borderColor: palette.background, borderWidth: 1 },
          data: analytics.funnel.map((stage) => ({
            name: stage.label,
            value: stage.value,
            rate: stage.rate,
            itemStyle: { color: stage.color },
          })),
        },
      ],
    }),
    [analytics.funnel, analytics.total, palette, reducedMotion],
  )

  const trendOption = useMemo<EChartsOption>(
    () => ({
      animation: !reducedMotion,
      color: [palette.info, palette.success, palette.danger],
      tooltip: { ...tooltip(palette), trigger: 'axis' },
      legend: {
        top: 0,
        textStyle: { color: palette.muted, fontSize: 11 },
        itemWidth: 9,
        itemHeight: 9,
      },
      grid: { left: 4, right: 12, top: 34, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: analytics.trend.map((point) => point.week),
        axisLine: { lineStyle: { color: palette.border } },
        axisTick: { show: false },
        axisLabel: { color: palette.muted, fontSize: 10, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: palette.border, type: 'dashed' } },
        axisLabel: { color: palette.muted, fontSize: 10 },
      },
      series: [
        {
          name: 'Entradas',
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2.5 },
          areaStyle: { opacity: 0.08 },
          data: analytics.trend.map((point) => point.entradas),
        },
        {
          name: 'Ganados',
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          data: analytics.trend.map((point) => point.ganados),
        },
        {
          name: 'Perdidos',
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          data: analytics.trend.map((point) => point.perdidos),
        },
      ],
    }),
    [analytics.trend, palette, reducedMotion],
  )

  const sources = analytics.sourcePerformance.slice(0, 7).reverse()
  const sourceOption = useMemo<EChartsOption>(
    () => ({
      animation: !reducedMotion,
      color: [palette.primary, palette.success],
      tooltip: {
        ...tooltip(palette),
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const items = Array.isArray(params) ? params : [params]
          const source = String(
            (items[0] as { axisValueLabel?: unknown } | undefined)?.axisValueLabel ?? '',
          )
          const performance = analytics.sourcePerformance.find((item) => item.source === source)
          return `${source}\nEntradas: ${performance?.leads ?? 0}\nGanados: ${performance?.won ?? 0}\nConversión: ${(performance?.rate ?? 0).toFixed(1)}%`
        },
      },
      legend: {
        top: 0,
        textStyle: { color: palette.muted, fontSize: 11 },
        itemWidth: 9,
        itemHeight: 9,
      },
      grid: { left: 4, right: 12, top: 34, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: palette.border, type: 'dashed' } },
        axisLabel: { color: palette.muted, fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: sources.map((item) => item.source),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: palette.muted, fontSize: 10, width: 94, overflow: 'truncate' },
      },
      series: [
        {
          name: 'Entradas',
          type: 'bar',
          data: sources.map((item) => item.leads),
          barMaxWidth: 14,
          itemStyle: { borderRadius: [0, 4, 4, 0] },
        },
        {
          name: 'Ganados',
          type: 'bar',
          data: sources.map((item) => item.won),
          barMaxWidth: 14,
          itemStyle: { borderRadius: [0, 4, 4, 0] },
        },
      ],
    }),
    [analytics.sourcePerformance, palette, reducedMotion, sources],
  )

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="xl:col-span-2">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>Recorrido de los leads</CardTitle>
            <p className="text-muted-foreground text-sm">
              Desde el origen hasta el resultado comercial. Pasa el cursor por un tramo para ver su
              volumen.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <EChart
            option={sankeyOption}
            label="Recorrido de leads por origen y etapa"
            className="h-[28rem] w-full"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversión por etapa</CardTitle>
          <p className="text-muted-foreground text-sm">
            Leads que llegaron a cada punto del embudo.
          </p>
        </CardHeader>
        <CardContent>
          <EChart
            option={funnelOption}
            label="Embudo de conversión por etapa"
            className="h-80 w-full"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ritmo comercial</CardTitle>
          <p className="text-muted-foreground text-sm">
            Entradas y cierres registrados cada semana.
          </p>
        </CardHeader>
        <CardContent>
          <EChart
            option={trendOption}
            label="Evolución semanal de entradas y cierres"
            className="h-80 w-full"
          />
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Rendimiento por origen</CardTitle>
          <p className="text-muted-foreground text-sm">
            Compara volumen y clientes ganados para decidir dónde enfocar el esfuerzo.
          </p>
        </CardHeader>
        <CardContent>
          <EChart
            option={sourceOption}
            label="Leads y ganados por origen"
            className="h-72 w-full"
          />
        </CardContent>
      </Card>
    </div>
  )
}
