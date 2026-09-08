import { ExternalLink } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getMarketingOverview } from '@/lib/marketing/queries'
import type { MarketingSort, MarketingView } from '@/lib/marketing/range'
import type { ActiveAdRow, CampaignRow } from '@/lib/marketing/types'
import { formatEUR, relativeTime } from '@/lib/utils'

import { AdPreviewDialog } from '../ad-preview-dialog'
import {
  buildAdsManagerUrl,
  buildCampaignManagerUrl,
  cn,
  cplClass,
  ctrClass,
  numberFmt,
  percentFmt,
} from './marketing-format'

type MarketingTableProps = {
  view: MarketingView
  since: string
  until: string
  sort: MarketingSort
  showPaused: boolean
  accountId: string | null
}

export async function MarketingTable({
  view,
  since,
  until,
  sort,
  showPaused,
  accountId,
}: MarketingTableProps) {
  const overview = await getMarketingOverview(view, since, until, sort, showPaused)
  const { avgCpc, totalImpressions, totalOutboundClicks, totalLandingPageViews, lastSyncAt } =
    overview

  return (
    <>
      {overview.view === 'campaigns' ? (
        <CampaignsTable campaigns={overview.campaigns} accountId={accountId} />
      ) : (
        <AdsTable ads={overview.ads} showPaused={showPaused} accountId={accountId} />
      )}

      <p className="text-muted-foreground text-xs">
        Datos atribuidos por Meta (acciones <code>lead</code> y{' '}
        <code>onsite_conversion.lead_grouped</code>). Clics salientes:{' '}
        {numberFmt.format(totalOutboundClicks)} · Vistas de landing:{' '}
        {numberFmt.format(totalLandingPageViews)} · CPC medio: {formatEUR(avgCpc)} · Impresiones:{' '}
        {numberFmt.format(totalImpressions)}.
        {lastSyncAt ? ` Sincronizado ${relativeTime(lastSyncAt)}.` : ''}
      </p>
    </>
  )
}

function AdsTable({
  ads,
  showPaused,
  accountId,
}: {
  ads: ActiveAdRow[]
  showPaused: boolean
  accountId: string | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anuncios {showPaused ? '(activos + pausados)' : 'activos'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Anuncio</TableHead>
              <TableHead>Campaña</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Impresiones</TableHead>
              <TableHead className="text-right">Clics</TableHead>
              <TableHead className="text-right">Salientes</TableHead>
              <TableHead className="text-right">Landing</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">CPC</TableHead>
              <TableHead className="text-right">Gasto</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">CPL</TableHead>
              <TableHead className="w-[88px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-muted-foreground py-8 text-center">
                  No hay anuncios con datos en el rango seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              ads.map((ad) => {
                const adsManagerUrl = buildAdsManagerUrl(ad.id, accountId)
                const isPaused = ad.status !== 'ACTIVE'
                return (
                  <TableRow key={ad.id} className={cn(isPaused && 'opacity-60')}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {ad.preview_url && (
                          // biome-ignore lint/performance/noImgElement: URL externa de preview del anuncio, no compatible con next/image
                          <img
                            src={ad.preview_url}
                            className="h-8 w-8 rounded object-cover"
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        <div className="min-w-0">
                          <span className="block truncate">{ad.name}</span>
                          {ad.destinationUrl ? (
                            <a
                              href={ad.destinationUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary block truncate text-xs hover:underline"
                              title={ad.destinationUrl}
                            >
                              {ad.callToActionType ?? 'Destino'}: {ad.destinationUrl}
                            </a>
                          ) : ad.leadFormId ? (
                            <span className="text-muted-foreground block truncate text-xs">
                              Formulario instantáneo: {ad.leadFormId}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{ad.campaignName}</TableCell>
                    <TableCell>
                      <Badge variant={isPaused ? 'outline' : 'success'}>{ad.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(ad.impressions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(ad.clicks)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(ad.outboundClicks)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(ad.landingPageViews)}
                    </TableCell>
                    <TableCell className={cn('text-right tabular-nums', ctrClass(ad.ctr))}>
                      {percentFmt.format(ad.ctr)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ad.clicks > 0 ? formatEUR(ad.cpc) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatEUR(ad.spend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{ad.leads}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        cplClass(ad.cpl, ad.leads),
                      )}
                    >
                      {ad.leads > 0 ? formatEUR(ad.cpl) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <AdPreviewDialog
                          adId={ad.id}
                          adName={ad.name}
                          campaignName={ad.campaignName}
                          adsManagerUrl={adsManagerUrl}
                        />
                        {adsManagerUrl ? (
                          <Button asChild variant="ghost" size="icon-sm">
                            <a
                              href={adsManagerUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Abrir en Meta Ads Manager"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CampaignsTable({
  campaigns,
  accountId,
}: {
  campaigns: CampaignRow[]
  accountId: string | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campañas</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaña</TableHead>
              <TableHead>Objetivo</TableHead>
              <TableHead className="text-right">Anuncios</TableHead>
              <TableHead className="text-right">Impresiones</TableHead>
              <TableHead className="text-right">Clics</TableHead>
              <TableHead className="text-right">Salientes</TableHead>
              <TableHead className="text-right">Landing</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">CPC</TableHead>
              <TableHead className="text-right">Gasto</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">CPL</TableHead>
              <TableHead className="w-16 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-muted-foreground py-8 text-center">
                  No hay campañas con datos en el rango seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((c) => {
                const url = buildCampaignManagerUrl(c.id, accountId)
                const isPaused = c.status !== 'ACTIVE'
                return (
                  <TableRow key={c.id} className={cn(isPaused && 'opacity-60')}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="truncate">{c.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {c.activeAdCount}/{c.adCount} anuncios activos
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {c.objective ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.adCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(c.impressions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(c.clicks)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(c.outboundClicks)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(c.landingPageViews)}
                    </TableCell>
                    <TableCell className={cn('text-right tabular-nums', ctrClass(c.ctr))}>
                      {percentFmt.format(c.ctr)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.clicks > 0 ? formatEUR(c.cpc) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatEUR(c.spend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.leads}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        cplClass(c.cpl, c.leads),
                      )}
                    >
                      {c.leads > 0 ? formatEUR(c.cpl) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {url ? (
                        <Button asChild variant="ghost" size="icon-sm">
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Abrir campaña en Meta Ads Manager"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
