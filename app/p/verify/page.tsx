import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Verificación · doscientos' }

type SearchParams = Promise<{ nif?: string; numserie?: string; fecha?: string; importe?: string }>

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verificación de factura</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="text-muted mb-4">
            Modo MOCK Verifactu (entorno interno). Estos datos provienen del QR de la factura.
          </p>
          <Row label="NIF emisor" value={p.nif} />
          <Row label="Nº serie" value={p.numserie} />
          <Row label="Fecha emisión" value={p.fecha} />
          <Row label="Importe" value={p.importe ? `${p.importe} €` : undefined} />
        </CardContent>
      </Card>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="border-border grid grid-cols-[140px_1fr] items-center gap-2 border-b py-1.5 last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="text-primary font-medium" data-tabular>
        {value ?? '—'}
      </span>
    </div>
  )
}
