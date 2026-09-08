import { ChartBar as BarChart3, ExternalLink, MessageSquare, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { getPostDetail } from "@/lib/social/service";
import { SOCIAL_POST_STATUS, SOCIAL_TARGET_STATUS } from "@/lib/status";
import { formatDateTime, relativeTime } from "@/lib/utils";

import { CommentCard } from "../_components/comment-card";
import { MediaThumb } from "../_components/media-thumb";
import { PlatformChip } from "../_components/platform";
import { PublishButton } from "../_components/publish-button";
import { SyncButton } from "../_components/sync-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostDetail(id);
  return { title: post ? `${post.caption.slice(0, 20)}... · Social` : "Post · Social" };
}

async function PostDetail({ id, canEdit }: { id: string; canEdit: boolean }) {
  const post = await getPostDetail(id);
  if (!post) notFound();

  const totalReach = post.targets.reduce((acc, t) => acc + (t.insights?.reach ?? 0), 0);
  const totalLikes = post.targets.reduce((acc, t) => acc + (t.insights?.likes ?? 0), 0);
  const totalComments = Math.max(
    post.targets.reduce((acc, t) => acc + (t.insights?.comments ?? 0), 0),
    post.comments.length,
  );
  const totalShares = post.targets.reduce((acc, t) => acc + (t.insights?.shares ?? 0), 0);
  const totalSaves = post.targets.reduce((acc, t) => acc + (t.insights?.saves ?? 0), 0);
  const totalActions = post.targets.reduce((acc, t) => acc + (t.insights?.actions ?? 0), 0);
  const totalInteractions = totalLikes + totalComments + totalShares + totalSaves;
  const engagementRate = totalReach > 0 ? (totalInteractions / totalReach) * 100 : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Main Content */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Contenido</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
                {post.caption}
              </div>
              {post.media.length > 0 && (
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
                  {post.media.map((item) => (
                    <MediaThumb key={item.storagePath} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Synced comments */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="size-4" />
                Comentarios
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">
                  {post.comments.length}
                </span>
              </h2>
            </div>
            {post.comments.length > 0 ? (
              <div className="flex flex-col gap-4">
                {post.comments.map((comment) => (
                  <CommentCard key={comment.id} comment={comment} showPostContext={false} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-muted-foreground py-8 text-center text-sm">
                  No hay comentarios sincronizados para esta publicación.
                </CardContent>
              </Card>
            )}
          </section>

          {/* Insights / Targets */}
          <Card>
            <CardHeader className="flex min-w-0 flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-medium">Resultados por red</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border text-muted-foreground border-b">
                      <th className="pr-4 pb-2 font-medium">Red</th>
                      <th className="pr-4 pb-2 font-medium">Estado</th>
                      <th className="pr-4 pb-2 text-right font-medium">Alcance</th>
                      <th className="pr-4 pb-2 text-right font-medium">Me gusta</th>
                      <th className="pr-4 pb-2 text-right font-medium">Coment.</th>
                      <th className="pr-4 pb-2 text-right font-medium">Acciones</th>
                      <th className="pb-2 text-right font-medium">Enlace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/50 divide-y">
                    {post.targets.map((t) => (
                      <tr key={t.id} className="group">
                        <td className="py-3 pr-4">
                          <PlatformChip platform={t.platform} />
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge
                              meta={SOCIAL_TARGET_STATUS}
                              value={t.status}
                              className="text-[10px]"
                            />
                            {t.status === "failed" && t.error && (
                              <span
                                className="text-destructive max-w-50 text-[10px] leading-tight wrap-break-word"
                                title={t.error}
                              >
                                {t.error.length > 80 ? `${t.error.slice(0, 80)}…` : t.error}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {t.insights?.reach.toLocaleString() ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {t.insights?.likes.toLocaleString() ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {t.insights?.comments.toLocaleString() ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {t.insights?.actions.toLocaleString() ?? "—"}
                        </td>
                        <td className="py-3 text-right">
                          {t.remoteUrl ? (
                            <a
                              href={t.remoteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-xs"
                            >
                              Ver <ExternalLink className="size-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar info */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Información</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailRow label="Estado">
                  <StatusBadge meta={SOCIAL_POST_STATUS} value={post.status} />
                </DetailRow>
                <DetailRow label="Creado">
                  <div className="flex flex-col">
                    <span>{formatDateTime(post.createdAt)}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {relativeTime(post.createdAt)}
                    </span>
                  </div>
                </DetailRow>
                {post.publishedAt && (
                  <DetailRow label="Publicado">
                    <span>{formatDateTime(post.publishedAt)}</span>
                  </DetailRow>
                )}
                {post.scheduledAt && !post.publishedAt && (
                  <DetailRow label="Programado">
                    <span>{formatDateTime(post.scheduledAt)}</span>
                  </DetailRow>
                )}
              </DetailGrid>

              {canEdit && post.status === "scheduled" && (
                <div className="border-border mt-6 border-t pt-4">
                  <Button asChild variant="outline" size="default" className="w-full">
                    <Link href={`/social/${post.id}/edit`}>
                      <Pencil className="size-4" />
                      Cambiar imagen
                    </Link>
                  </Button>
                </div>
              )}

              {canEdit && (post.status === "draft" || post.status === "scheduled") && (
                <div className="border-border mt-6 border-t pt-4">
                  <PublishButton
                    postId={post.id}
                    label={post.status === "scheduled" ? "Publicar ahora" : undefined}
                    size="default"
                    className="w-full"
                  />
                </div>
              )}
              {(post.status === "failed" || post.status === "partially_failed") && (
                <div className="border-border mt-6 border-t pt-4">
                  <PublishButton postId={post.id} retry size="default" className="w-full" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="size-4" />
                Resumen de impacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Aggregate stats from the latest successful sync. */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-[10px] uppercase">Reach Total</span>
                  <span className="text-xl font-bold tabular-nums">
                    {totalReach > 0 ? totalReach.toLocaleString() : "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-[10px] uppercase">Interacciones</span>
                  <span className="text-xl font-bold tabular-nums">
                    {totalInteractions.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-[10px] uppercase">Me gusta</span>
                  <span className="text-xl font-bold tabular-nums">
                    {totalLikes.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-[10px] uppercase">Comentarios</span>
                  <span className="text-xl font-bold tabular-nums">
                    {totalComments.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-[10px] uppercase">Acciones</span>
                  <span className="text-xl font-bold tabular-nums">
                    {totalActions.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="border-border/60 border-t pt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground text-xs">Engagement medio</span>
                  <span className="font-semibold tabular-nums">
                    {engagementRate === null ? "—" : `${engagementRate.toFixed(1)}%`}
                  </span>
                </div>
                {engagementRate === null && (
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    La red todavía no ha devuelto datos de alcance.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[150px] w-full" />
        </div>
      </div>
    </div>
  );
}

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/social" label="Social" />
      <PageHeader
        title="Detalle de publicación"
        description="Métricas y estado de publicación en tiempo real."
        actions={<SyncButton kind="social" label="Sincronizar datos" />}
      />
      <SectionBoundary pending={<DetailSkeleton />} label="No se pudo cargar el detalle">
        <PostDetail id={id} canEdit={user.role !== "viewer"} />
      </SectionBoundary>
    </div>
  );
}
