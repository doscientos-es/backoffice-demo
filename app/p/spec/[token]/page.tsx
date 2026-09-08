import { notFound } from 'next/navigation'

import { LogoMark } from '@/components/branding'
import { Markdown } from '@/components/ui/markdown'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Documentación técnica · doscientos',
  robots: { index: false, follow: false },
}

/**
 * Public, unauthenticated view of a `technical_spec` document.
 *
 * Access is gated by an unguessable `portal_token` AND `is_client_visible = true`.
 * We use the service-role client because the document is meant to be readable
 * without a session — same pattern as `/p/proposal/[token]` and
 * `/p/invoice/[token]`.
 */
export default async function PortalSpecPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('proposal_specs')
    .select(
      'id, title, body_markdown, is_client_visible, updated_at, proposal_id, proposals(number, title, portal_token)',
    )
    .eq('portal_token', token)
    .eq('is_client_visible', true)
    .maybeSingle()

  if (!doc) notFound()

  const proposal = (
    doc as unknown as {
      proposals: { number: string; title: string; portal_token: string | null } | null
    }
  ).proposals

  return (
    <article className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      {/* Document header */}
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-8 py-7 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <LogoMark size={20} className="text-[#2A4227] dark:text-[#9CC196]" />
          <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            doscientos
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
            Documentación técnica
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {doc.title as string}
          </h1>
          {proposal ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Vinculada a la propuesta{' '}
              {proposal.portal_token ? (
                <a
                  href={`/p/proposal/${proposal.portal_token}`}
                  className="font-medium text-[#2A4227] hover:underline dark:text-[#9CC196]"
                >
                  {proposal.number} · {proposal.title}
                </a>
              ) : (
                <strong className="text-zinc-700 dark:text-zinc-300">
                  {proposal.number} · {proposal.title}
                </strong>
              )}
            </p>
          ) : null}
          {doc.updated_at ? (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
              Actualizada el {formatDate(doc.updated_at as string)}
            </p>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="px-8 py-7">
        <Markdown source={doc.body_markdown as string} />
      </div>
    </article>
  )
}
