import { Download } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DetailGrid, DetailRow } from '@/components/layout/detail-grid'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DocPreview } from '@doscientos/ui'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** Preview TTL: 10 min — long enough to browse the document comfortably. */
const PREVIEW_TTL = 600

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data } = await supabase.from('attachments').select('name').eq('id', id).maybeSingle()
  return { title: data?.name ? `${data.name as string} · doscientos` : 'Documento · doscientos' }
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: doc } = await supabase
    .from('attachments')
    .select('id, name, mime_type, size_bytes, storage_path, created_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) notFound()

  const storagePath = doc.storage_path as string | null

  // Generate preview URL server-side so it's ready when the page renders.
  let previewUrl: string | null = null
  if (storagePath) {
    const { url } = await getStorage().createSignedUrl('documents', storagePath, PREVIEW_TTL)
    previewUrl = url
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={doc.name as string}
        breadcrumbs={[{ label: 'Documentos', href: '/documents' }, { label: doc.name as string }]}
        actions={
          <Button asChild size="sm">
            <Link href={`/api/documents/${id}/download`} target="_blank" rel="noopener noreferrer">
              <Download className="size-3.5" />
              Descargar
            </Link>
          </Button>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Detalles</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailRow label="Tipo">{(doc.mime_type as string | null) ?? '—'}</DetailRow>
            <DetailRow label="Tamaño">
              {doc.size_bytes ? `${Math.ceil(Number(doc.size_bytes) / 1024)} KB` : '—'}
            </DetailRow>
            <DetailRow label="Subido">{formatDate(doc.created_at as string)}</DetailRow>
          </DetailGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden rounded-b-lg p-0">
          <DocPreview
            url={previewUrl}
            mimeType={doc.mime_type as string | null}
            name={doc.name as string}
          />
        </CardContent>
      </Card>
    </div>
  )
}
