import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getLeadFunnelBySource } from '@/lib/marketing/queries'
import { formatEUR } from '@/lib/utils'

function pct(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value * 100)} %`
}

export async function AttributionFunnel({ since, until }: { since: string; until: string }) {
  const rows = await getLeadFunnelBySource(since, until)

  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Embudo por canal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Sin datos de leads para el período seleccionado.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Embudo por canal</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Calificados</TableHead>
              <TableHead className="text-right">Ganados</TableHead>
              <TableHead className="text-right">Conversión</TableHead>
              <TableHead className="text-right">Pipeline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.source}>
                <TableCell className="font-medium">{row.source}</TableCell>
                <TableCell className="text-right">{row.total}</TableCell>
                <TableCell className="text-right">{row.qualified}</TableCell>
                <TableCell className="text-right">{row.won}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(row.conversionRate)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatEUR(row.pipelineValue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
