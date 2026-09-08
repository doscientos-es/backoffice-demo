import { Download } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DetailGrid, DetailRow } from '@/components/layout/detail-grid'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DangerZone } from '@/components/ui/danger-zone'
import { DocPreview } from '@doscientos/ui'
import { SubmitButton } from '@/components/ui/submit-button'
import { requireUser } from '@/lib/auth'
import type { InternalDocCategory, InternalDocVisibility } from '@/lib/schemas/internal-doc'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

import { deleteInternalDoc, reindexInternalDoc } from '../actions'
import { InternalDocEditDialog } from './internal-doc-edit-dialog'
import { type InternalDocEvent, InternalDocHistory } from './internal-doc-history'

/** Preview TTL: 10 min — long enough to browse the document comfortably. */
const PREVIEW_TTL = 600

export const dynamic = 'force-dynamic'

const CATEGORY_LABELS: Record<string, string> = {
  legal: 'Legal',
  hr: 'RRHH',
  finance: 'Finanzas',
  templates: 'Plantillas',
  policies: 'Políticas',
  meetings: 'Actas',
  other: 'Otro',
}

type ExtractionStatus = {
  status: string
  page_count: number | null
  truncated: boolean | null
}

function extractionFeedback(extraction: ExtractionStatus | null) {
  if (!extraction) {
    return {
      label: 'Aún no está preparado para consultas',
      detail: 'Pulsa «Preparar para consultas» para que el asistente pueda buscar dentro del PDF.',
    }
  }
  if (extraction.status === 'extracted') {
    const suffix = extraction.truncated ? ' · texto parcial' : ''
    return {
      label: `Listo para consultar · ${extraction.page_count ?? 0} páginas${suffix}`,
      detail: 'El asistente puede responder con extractos y la página de origen.',
    }
  }
  if (extraction.status === 'no_text') {
    return {
      label: 'No hemos encontrado texto digital',
      detail:
        'Parece un PDF escaneado. El archivo original sigue disponible, pero hace falta OCR para buscar en su contenido.',
    }
  }
  if (extraction.status === 'unsupported') {
    return {
      label: 'Este formato todavía no se puede consultar por contenido',
      detail:
        'Puedes abrir o descargar el archivo original; el asistente solo podrá encontrarlo por nombre y metadatos.',
    }
  }
  if (extraction.status === 'processing') {
    return {
      label: 'Estamos preparando el contenido',
      detail: 'El PDF se ha guardado correctamente. Vuelve a abrir esta página en unos instantes.',
    }
  }
  return {
    label: 'No hemos podido preparar el contenido todavía',
    detail:
      'El archivo original sigue intacto. Prueba a prepararlo de nuevo o ábrelo para revisarlo manualmente.',
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('internal_documents')
    .select('name')
    .eq('id', id)
    .maybeSingle()
  return { title: data?.name ? `${data.name as string} · doscientos` : 'Documento · doscientos' }
}

export default async function InternalDocDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params

  const supabase = await createServerClient()
  const { data: doc } = await supabase
    .from('internal_documents')
    .select(
      'id, name, description, category, tags, mime_type, size_bytes, storage_path, version, visibility, effective_date, expires_at, created_at, uploaded_by, deleted_at, team_members:uploaded_by(name)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) notFound()

  const isAdmin = ['owner', 'admin'].includes(user.role)
  const isAdminsOnly = (doc.visibility as string) === 'admins_only'

  // Non-admins cannot see admins_only docs (RLS also guards this, belt + suspenders)
  if (isAdminsOnly && !isAdmin) notFound()

  const uploaderName =
    (doc as unknown as { team_members: { name: string } | null }).team_members?.name ?? '—'

  const storagePath = doc.storage_path as string | null
  let previewUrl: string | null = null
  if (storagePath) {
    const { url } = await getStorage().createSignedUrl('internal-docs', storagePath, PREVIEW_TTL)
    previewUrl = url
  }

  // Audit trail and extraction status. RLS mirrors the document's visibility.
  const [{ data: rawEvents }, { data: rawExtraction }] = await Promise.all([
    supabase
      .from('internal_document_events')
      .select('id, action, created_at, payload, team_members:actor_id(name)')
      .eq('document_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('internal_document_extractions')
      .select('status, page_count, truncated')
      .eq('document_id', id)
      .maybeSingle(),
  ])

  const events: InternalDocEvent[] = (rawEvents ?? []).map((e) => ({
    id: e.id as string,
    action: e.action as InternalDocEvent['action'],
    created_at: e.created_at as string,
    payload: (e.payload as Record<string, unknown>) ?? {},
    actorName:
      (e as unknown as { team_members: { name: string } | null }).team_members?.name ?? null,
  }))

  const tags = ((doc.tags as string[] | null) ?? []).filter(Boolean)
  const extraction = (rawExtraction as ExtractionStatus | null) ?? null
  const extractionFeedbackMessage = extractionFeedback(extraction)
  // Editors (anyone above viewer) may edit metadata; only admins toggle visibility.
  const canEdit = user.role !== 'viewer'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={doc.name as string}
        breadcrumbs={[
          { label: 'Docs internos', href: '/internal-docs' },
          { label: doc.name as string },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <InternalDocEditDialog
                doc={{
                  id: doc.id as string,
                  name: doc.name as string,
                  description: (doc.description as string | null) ?? null,
                  category: doc.category as InternalDocCategory,
                  visibility: doc.visibility as InternalDocVisibility,
                  tags,
                  effective_date: (doc.effective_date as string | null) ?? null,
                  expires_at: (doc.expires_at as string | null) ?? null,
                }}
                canEditVisibility={isAdmin}
              />
            )}
            {canEdit && (doc.mime_type as string | null) === 'application/pdf' && (
              <form action={reindexInternalDoc}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="outline" pendingLabel="Preparando contenido…">
                  {extraction ? 'Volver a preparar' : 'Preparar para consultas'}
                </SubmitButton>
              </form>
            )}
            <Button asChild size="sm">
              <Link
                href={`/api/internal-docs/${id}/download`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="size-3.5" />
                Descargar
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        {/* Left column: metadata + danger zone */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailRow label="Categoría">
                  {CATEGORY_LABELS[(doc.category as string) ?? 'other']}
                </DetailRow>
                <DetailRow label="Visibilidad">
                  {isAdminsOnly ? (
                    <Badge variant="warning">Solo admins</Badge>
                  ) : (
                    <Badge variant="neutral">Todo el equipo</Badge>
                  )}
                </DetailRow>
                <DetailRow label="Tipo">{(doc.mime_type as string | null) ?? '—'}</DetailRow>
                <DetailRow label="Consulta por IA">
                  <span className="flex flex-col gap-1">
                    <span>{extractionFeedbackMessage.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {extractionFeedbackMessage.detail}
                    </span>
                  </span>
                </DetailRow>
                <DetailRow label="Tamaño">
                  {doc.size_bytes ? `${Math.ceil(Number(doc.size_bytes) / 1024)} KB` : '—'}
                </DetailRow>
                <DetailRow label="Versión">v{doc.version as number}</DetailRow>
                {tags.length > 0 && (
                  <DetailRow label="Etiquetas">
                    <span className="flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="neutral">
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  </DetailRow>
                )}
                {doc.effective_date && (
                  <DetailRow label="Vigencia desde">
                    {formatDate(doc.effective_date as string)}
                  </DetailRow>
                )}
                {doc.expires_at && (
                  <DetailRow label="Expira">{formatDate(doc.expires_at as string)}</DetailRow>
                )}
                <DetailRow label="Subido por">{uploaderName}</DetailRow>
                <DetailRow label="Fecha">{formatDate(doc.created_at as string)}</DetailRow>
              </DetailGrid>

              {doc.description && (
                <p className="text-muted-foreground mt-4 text-sm whitespace-pre-wrap">
                  {doc.description as string}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <InternalDocHistory events={events} />
            </CardContent>
          </Card>

          {isAdmin && (
            <DangerZone>
              <form action={deleteInternalDoc} className="flex items-center gap-4">
                <input type="hidden" name="id" value={id} />
                <p className="text-muted-foreground flex-1 text-sm">
                  Eliminar este documento de forma permanente. Esta acción no se puede deshacer.
                </p>
                <SubmitButton variant="destructive" size="sm" pendingLabel="Eliminando…">
                  Eliminar
                </SubmitButton>
              </form>
            </DangerZone>
          )}
        </div>

        {/* Right column: preview */}
        <Card className="min-w-0">
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
    </div>
  )
}
