"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  TriangleAlert as AlertTriangle,
  CalendarDays as CalendarClock,
  CalendarPlus,
  Funnel as Filter,
  GripVertical,
  History as HistoryIcon,
  Hourglass,
  Mail,
  Maximize2,
  Minimize2,
  Phone,
  Plus,
  RefreshCw,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Button as PopoverButton, PopoverContent, PopoverTrigger } from "@doscientos/ui";
import {
  boardColumnForLead,
  countLeadsNeedingAttention,
  groupLeadsForKanban,
  LEAD_KANBAN_COLUMNS,
  type LeadKanbanColumnId,
  nextActionForKanban,
  sumLeadEstimatedValue,
} from "@/lib/leads/kanban-policy";
import {
  type LeadKanbanColumnPreferences,
  leadKanbanColumnIds,
  preferencesFromLegacyCompactColumns,
  resolveCompactLeadKanbanColumns,
  toggleLeadKanbanColumnPreference,
} from "@/lib/leads/kanban-preferences";
import {
  isRotting,
  nextActionState,
  STAGE_ROT_DAYS,
  waitingForReplySince,
} from "@/lib/leads/pipeline";
import { requiresCyaProspectSoftwareCommission } from "@/lib/leads/attribution";
import type { LeadListItem, LeadMemberRef } from "@/lib/leads/types";
import { leadDisplayName } from "@/lib/leads/utils";
import type { MemberOption } from "@/lib/members/queries";
import type { LeadStatus } from "@/lib/status";
import { cn, formatEUR, relativeTime } from "@/lib/utils";

import { ScheduleReminderDialog } from "../reminders/schedule-reminder-dialog";
import { LeadCallLink } from "./[id]/phone-actions";
import { deleteLead, updateLeadStatus } from "./actions";
import { CloseReasonDialog, type CloseReasonVariant } from "./close-reason-dialog";
import { LeadQuickView } from "./lead-quick-view";
import { QuotedSuggestionDialog } from "./quoted-suggestion-dialog";
import { ReopenConfirmDialog } from "./reopen-confirm-dialog";

const URGENCY_STYLE: Record<string, string> = {
  Inmediata: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  "Este mes": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "Este trimestre": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  "Sin urgencia": "bg-muted text-muted-foreground",
};

export type KanbanLead = LeadListItem;

const INTERACTION_LABEL: Record<string, string> = {
  email_sent: "Email enviado",
  email_received: "Email recibido",
  email_delivered: "Email entregado",
  email_opened: "Email abierto",
  email_clicked: "Email con clic",
  email_bounced: "Email rebotado",
  email_complained: "Email marcado como spam",
  email_scheduled: "Email programado",
  email_delivery_delayed: "Entrega de email retrasada",
  email_failed: "Error al enviar el email",
  email_suppressed: "Email suprimido",
  call: "Llamada",
  meeting: "Reunión",
  note: "Nota",
  owner_change: "Responsable cambiado",
  status_change: "Cambio de estado",
};

const REOPEN_INTO: ReadonlySet<LeadStatus> = new Set([
  "new",
  "contacted",
  "in_conversation",
  "quoted",
]);

const STATUS_BY_COLUMN: Record<Exclude<LeadKanbanColumnId, "meeting">, LeadStatus> = {
  new: "new",
  in_conversation: "in_conversation",
  waiting: "contacted",
  quoted: "quoted",
  won: "won",
  lost: "lost",
  not_interested: "not_interested",
  archived: "archived",
};

const COMPACT_COLUMNS_KEY = "leads-kanban:compact-columns:v2";

function loadColumnPreferences(key: string): LeadKanbanColumnPreferences | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const stored: unknown = JSON.parse(raw);
    if (Array.isArray(stored)) {
      return preferencesFromLegacyCompactColumns(leadKanbanColumnIds(stored));
    }
    if (!stored || typeof stored !== "object") return null;
    const preferences = stored as Record<string, unknown>;
    return {
      compact: leadKanbanColumnIds(preferences.compact),
      expanded: leadKanbanColumnIds(preferences.expanded),
    };
  } catch {
    return null;
  }
}

function saveColumnPreferences(key: string, value: LeadKanbanColumnPreferences) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The preference is optional when browser storage is unavailable.
  }
}

type Action = { type: "move"; id: string; status: LeadStatus } | { type: "remove"; id: string };

export function LeadsKanban({
  leads,
  canEdit = false,
  aiEnabled = false,
  googleEnabled = false,
  members = [],
}: {
  leads: KanbanLead[];
  canEdit?: boolean;
  aiEnabled?: boolean;
  googleEnabled?: boolean;
  members?: MemberOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isRefreshing, startRefresh] = useTransition();
  const [lastRefresh, setLastRefresh] = useState<Date>(() => new Date());
  const [optimistic, applyOptimistic] = useOptimistic(leads, (state, action: Action) =>
    action.type === "remove"
      ? state.filter((l) => l.id !== action.id)
      : state.map((l) => (l.id === action.id ? { ...l, status: action.status } : l)),
  );
  const [columnPreferences, setColumnPreferences] = useState<LeadKanbanColumnPreferences>({
    compact: [],
    expanded: [],
  });
  useEffect(() => {
    const storedPreferences = loadColumnPreferences(COMPACT_COLUMNS_KEY);
    if (storedPreferences) setColumnPreferences(storedPreferences);
  }, []);

  const toggleColumnCompact = (id: LeadKanbanColumnId) => {
    setColumnPreferences((previous) => {
      const preferences = toggleLeadKanbanColumnPreference(previous, id);
      saveColumnPreferences(COMPACT_COLUMNS_KEY, preferences);
      return preferences;
    });
  };
  const handleRefresh = () => {
    startRefresh(() => {
      router.refresh();
      setLastRefresh(new Date());
    });
  };
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingClosure, setPendingClosure] = useState<{
    id: string;
    name: string;
    variant: CloseReasonVariant;
  } | null>(null);
  const [pendingReopen, setPendingReopen] = useState<{
    id: string;
    name: string;
    to: LeadKanbanColumnId;
  } | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [pendingMeeting, setPendingMeeting] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const feedback = useFormFeedback();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const commitMove = (id: string, status: LeadStatus, lostReason?: string) => {
    startTransition(async () => {
      applyOptimistic({ type: "move", id, status });
      feedback.setPending();
      const res = await updateLeadStatus({ leadId: id, status, lostReason });
      if (!res.ok) feedback.setError(res.error);
      else feedback.setSuccess("Estado actualizado");
    });
  };

  // Optimistically drops the card from the board; the server revalidation keeps
  // it gone on success, and on failure React reverts the state (the card
  // reappears) with an error shown in the feedback bar.
  const commitDelete = (id: string) => {
    setQuickViewId(null);
    startTransition(async () => {
      applyOptimistic({ type: "remove", id });
      feedback.setPending();
      const res = await deleteLead({ id });
      if (!res.ok) feedback.setError(res.error);
      else feedback.setSuccess("Lead eliminado");
    });
  };

  const moveToColumn = (lead: KanbanLead, column: LeadKanbanColumnId) => {
    if (column === "meeting") {
      if (lead.status !== "in_conversation") commitMove(lead.id, "in_conversation");
      setPendingMeeting({ id: lead.id, name: leadDisplayName(lead) });
      return;
    }

    const status = STATUS_BY_COLUMN[column];
    if (status === "lost" || status === "not_interested") {
      setPendingClosure({ id: lead.id, name: leadDisplayName(lead), variant: status });
      return;
    }

    commitMove(lead.id, status);
    if (status === "quoted") setPendingSuggestion({ id: lead.id, name: leadDisplayName(lead) });
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (!event.over) return;
    const id = String(event.active.id);
    const column = String(event.over.id) as LeadKanbanColumnId;
    const current = optimistic.find((lead) => lead.id === id);
    if (!current || boardColumnForLead(current) === column) return;

    const targetStatus = column === "meeting" ? "in_conversation" : STATUS_BY_COLUMN[column];
    if (current.status === "won" && REOPEN_INTO.has(targetStatus)) {
      setPendingReopen({ id, name: leadDisplayName(current), to: column });
      return;
    }

    moveToColumn(current, column);
  };

  const grouped = groupLeadsForKanban(optimistic);
  const compactColumns = resolveCompactLeadKanbanColumns(columnPreferences);
  const active = activeId ? optimistic.find((lead) => lead.id === activeId) : null;
  const refreshLabel = isRefreshing
    ? "Actualizando leads"
    : `Actualizar leads; actualizado ${relativeTime(lastRefresh.toISOString())}`;

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="scroll-fade-x no-scrollbar flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-2">
            {LEAD_KANBAN_COLUMNS.map((col) => (
              <Column
                key={col.id}
                status={col.id}
                label={col.label}
                description={col.description}
                tone={col.tone}
                dot={col.dot}
                leads={grouped.get(col.id) ?? []}
                canEdit={canEdit}
                compact={compactColumns.has(col.id)}
                isDragging={activeId !== null}
                onOpenQuickView={setQuickViewId}
                onToggleCompact={() => toggleColumnCompact(col.id)}
              />
            ))}
          </div>
          <div className="flex h-5 shrink-0 items-center justify-between">
            <FormFeedback state={feedback.state} pendingLabel="Actualizando…" />
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-muted-foreground hover:text-foreground flex items-center transition-colors disabled:opacity-50"
              aria-label={refreshLabel}
              title={refreshLabel}
            >
              <RefreshCw className={cn("size-3", isRefreshing && "animate-spin")} />
              <span className="sr-only">{refreshLabel}</span>
            </button>
          </div>
        </div>
        <DragOverlay>{active ? <Card lead={active} isOverlay /> : null}</DragOverlay>
      </DndContext>
      <CloseReasonDialog
        lead={pendingClosure ? { id: pendingClosure.id, name: pendingClosure.name } : null}
        variant={pendingClosure?.variant ?? "lost"}
        onCancel={() => setPendingClosure(null)}
        onConfirm={(reason) => {
          if (!pendingClosure) return;
          const { id, variant } = pendingClosure;
          setPendingClosure(null);
          commitMove(id, variant, reason);
        }}
      />
      <ReopenConfirmDialog
        lead={pendingReopen ? { id: pendingReopen.id, name: pendingReopen.name } : null}
        onCancel={() => setPendingReopen(null)}
        onConfirm={() => {
          if (!pendingReopen) return;
          const { id, to } = pendingReopen;
          setPendingReopen(null);
          const lead = optimistic.find((item) => item.id === id);
          if (lead) moveToColumn(lead, to);
        }}
      />
      <QuotedSuggestionDialog lead={pendingSuggestion} onClose={() => setPendingSuggestion(null)} />
      <ScheduleReminderDialog
        key={pendingMeeting?.id ?? "meeting"}
        leadId={pendingMeeting?.id}
        open={pendingMeeting !== null}
        onOpenChange={(open) => {
          if (!open) setPendingMeeting(null);
        }}
        defaultTitle={pendingMeeting ? `Reunión con ${pendingMeeting.name}` : ""}
        defaultActionType="meeting"
        members={members}
        onScheduled={() => router.refresh()}
      />
      <LeadQuickView
        lead={quickViewId ? (optimistic.find((l) => l.id === quickViewId) ?? null) : null}
        canEdit={canEdit}
        aiEnabled={aiEnabled}
        googleEnabled={googleEnabled}
        members={members}
        onDeleteAction={commitDelete}
        onCloseAction={() => setQuickViewId(null)}
      />
    </>
  );
}

function Column({
  status,
  label,
  description,
  tone,
  dot,
  leads,
  canEdit,
  compact,
  isDragging,
  onOpenQuickView,
  onToggleCompact,
}: {
  status: LeadKanbanColumnId;
  label: string;
  description: string;
  tone: string;
  dot: string;
  leads: KanbanLead[];
  canEdit: boolean;
  compact: boolean;
  isDragging: boolean;
  onOpenQuickView: (id: string) => void;
  onToggleCompact: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [isHovered, setIsHovered] = useState(false);
  const total = sumLeadEstimatedValue(leads);
  const attention = countLeadsNeedingAttention(leads);
  const collapsed = compact && !isOver && !isHovered;
  return (
    <section
      ref={setNodeRef}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      aria-label={`${label} · ${leads.length} lead${leads.length === 1 ? "" : "s"}`}
      title={collapsed ? `${label} (${leads.length}) · pasa el cursor para expandir` : undefined}
      className={cn(
        "relative flex h-full w-80 shrink-0 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        "transition-[width,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        collapsed && "md:w-11 md:cursor-pointer md:bg-muted/30",
        isOver && "bg-primary/5 ring-2 ring-primary/50",
        isDragging && !isOver && "ring-dashed ring-primary/30",
      )}
    >
      <header className={cn("shrink-0 border-b border-border px-3 py-3", collapsed && "md:px-1.5")}>
        <div className={cn("flex min-w-0 items-center gap-2", collapsed && "md:flex-col")}>
          <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-semibold",
              tone,
              collapsed ? "md:rotate-180 md:[writing-mode:vertical-rl]" : undefined,
            )}
          >
            {label}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {attention > 0 && (
              <Badge
                variant="danger"
                className={cn("h-5 gap-1 text-[11px] tabular-nums", collapsed && "md:hidden")}
                title={`${attention} lead${attention === 1 ? "" : "s"} sin próxima acción o con el aviso vencido`}
              >
                <AlertTriangle className="size-2.5" aria-hidden />
                {attention}
              </Badge>
            )}
            <Badge variant="neutral" className="h-5 text-[11px] tabular-nums">
              {leads.length}
            </Badge>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleCompact();
              }}
              title={compact ? "Mantener siempre visible" : "Colapsar cuando no esté en uso"}
              aria-label={compact ? "Mantener siempre visible" : "Colapsar cuando no esté en uso"}
              className={cn(
                "hidden shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                isHovered && "md:inline-flex",
              )}
            >
              {compact ? <Maximize2 className="size-3" /> : <Minimize2 className="size-3" />}
            </button>
          </div>
        </div>
        <p
          className={cn(
            "mt-1.5 truncate pl-4 text-[11px] text-muted-foreground",
            collapsed && "md:hidden",
          )}
        >
          {description}
        </p>
        {total > 0 ? (
          <p
            className={cn(
              "mt-2 pl-4 text-xs font-medium tabular-nums text-foreground/80",
              collapsed && "md:hidden",
            )}
          >
            {formatEUR(total)}
          </p>
        ) : null}
      </header>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5 scroll-fade no-scrollbar",
          collapsed && "md:hidden",
        )}
      >
        {leads.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-xs">
            {isDragging ? "Soltar aquí" : "Sin leads"}
          </p>
        ) : (
          leads.map((l) => (
            <Card key={l.id} lead={l} canEdit={canEdit} onOpenQuickView={onOpenQuickView} />
          ))
        )}
        {status === "new" && <AddLeadCard />}
      </div>
    </section>
  );
}

function AddLeadCard() {
  return (
    <Link
      href="/leads/new"
      className="border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors"
    >
      <Plus className="size-3.5 shrink-0" />
      Añadir lead
    </Link>
  );
}

function LeadAvatar({ lead }: { lead: KanbanLead }) {
  const name = lead.client?.name ?? leadDisplayName(lead);
  return (
    <EntityAvatar
      name={name}
      logoUrl={lead.client?.logo_url}
      size="sm"
      className="size-6 rounded-full"
    />
  );
}

function Card({
  lead,
  isOverlay = false,
  canEdit = false,
  onOpenQuickView,
}: {
  lead: KanbanLead;
  isOverlay?: boolean;
  canEdit?: boolean;
  onOpenQuickView?: (id: string) => void;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    disabled: !canEdit || isOverlay,
  });
  const rotting = isRotting(lead.status, lead.updated_at);
  const rotDays = STAGE_ROT_DAYS[lead.status];
  return (
    <article
      ref={setNodeRef}
      className={cn(
        "group flex flex-col gap-2 rounded-lg bg-background p-3 text-left ring-1 ring-border transition-all hover:shadow-sm hover:ring-foreground/20",
        isDragging && "opacity-30",
        isOverlay && "cursor-grabbing shadow-lg ring-foreground/30",
        rotting && !isOverlay && "ring-amber-400/60 dark:ring-amber-500/40",
      )}
    >
      <div className="flex items-start gap-2">
        {canEdit ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Arrastrar ${leadDisplayName(lead)}`}
            title="Arrastrar lead"
            className="text-muted-foreground/45 hover:text-foreground focus-visible:ring-ring/50 mt-0.5 shrink-0 cursor-grab touch-none rounded focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        ) : null}
        <LeadAvatar lead={lead} />
        <div className="min-w-0 flex-1">
          {onOpenQuickView ? (
            <button
              type="button"
              onClick={() => onOpenQuickView(lead.id)}
              className="hover:text-primary focus-visible:ring-ring/50 block max-w-full truncate text-left text-sm leading-tight font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              title="Abrir panel rápido"
            >
              {leadDisplayName(lead)}
            </button>
          ) : (
            <span className="block truncate text-sm leading-tight font-medium">
              {leadDisplayName(lead)}
            </span>
          )}
          {lead.alias?.trim() && lead.alias.trim() !== lead.name ? (
            <p className="text-muted-foreground truncate text-[11px] leading-tight">{lead.name}</p>
          ) : null}
        </div>
        {rotting && !isOverlay && (
          <span
            role="img"
            aria-label="Lead estancado: necesita seguimiento"
            title={`Sin movimiento ${relativeTime(lead.updated_at)} (esta etapa admite ${rotDays} d)`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
          >
            <AlertTriangle className="size-2.5" aria-hidden />
          </span>
        )}
      </div>
      {!isOverlay && <NextActionChip lead={lead} />}
      {!isOverlay && (lead.company || lead.phone || lead.email) && (
        <div className="flex min-w-0 flex-col gap-0.5 pl-8 text-xs">
          {lead.company ? <p className="text-muted-foreground truncate">{lead.company}</p> : null}
          {lead.phone ? (
            <LeadCallLink
              leadId={lead.id}
              phone={lead.phone}
              aria-label={`Llamar a ${leadDisplayName(lead)}`}
              className="text-muted-foreground hover:text-primary focus-visible:ring-ring/50 inline-flex min-w-0 items-center gap-1 truncate transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Phone className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{lead.phone}</span>
            </LeadCallLink>
          ) : null}
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              aria-label={`Enviar email a ${leadDisplayName(lead)}`}
              className="text-muted-foreground hover:text-primary focus-visible:ring-ring/50 inline-flex min-w-0 items-center gap-1 truncate transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Mail className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{lead.email}</span>
            </a>
          ) : null}
        </div>
      )}
      {!isOverlay && lead.urgency && (
        <div className="flex flex-wrap items-center gap-1 pl-8">
          <span
            className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
              URGENCY_STYLE[lead.urgency] ?? "bg-muted text-muted-foreground",
            )}
          >
            {lead.urgency}
          </span>
        </div>
      )}
      {!isOverlay && lead.status === "lost" && lead.lost_reason ? (
        <p
          className="text-destructive/75 truncate pl-8 text-[11px]"
          title={`Motivo de pérdida: ${lead.lost_reason}`}
        >
          <span className="font-medium">Pérdida:</span> {lead.lost_reason}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-1.5 pl-8">
        <div className="flex items-center gap-1.5">
          {lead.score != null && (
            <Badge variant="neutral" className="h-4 px-1.5 text-[10px] tabular-nums">
              {lead.score}
            </Badge>
          )}
          {lead.estimated_value != null && lead.estimated_value > 0 && (
            <Badge variant="neutral" className="h-4 px-1.5 text-[10px] tabular-nums">
              {formatEUR(lead.estimated_value)}
            </Badge>
          )}
          {!isOverlay && requiresCyaProspectSoftwareCommission(lead.marketing_campaign_name) && (
            <Badge
              variant="warning"
              className="h-4 px-1.5 text-[10px]"
              title="Comisión CYA: 20 % de lo ganado"
            >
              CYA · 20 %
            </Badge>
          )}
          {!isOverlay && <RecentActivity lead={lead} />}
        </div>
        {lead.assignee ? <MemberFilterPopover member={lead.assignee} /> : null}
      </div>
    </article>
  );
}

/**
 * The second axis of the board: what has to happen next on this lead and when.
 * A missing next action is rendered as loudly as an overdue one — both mean
 * nobody is driving the deal. When the ball is in the lead's court the chip
 * also says since when we are waiting.
 */
function NextActionChip({ lead }: { lead: KanbanLead }) {
  const next = nextActionForKanban(lead);
  const state = nextActionState(lead.status, next);
  if (state === "none") return null;

  const waitingSince = waitingForReplySince(lead.recent_interactions);
  const waiting =
    waitingSince && state !== "overdue" ? (
      <span
        className="text-muted-foreground inline-flex items-center gap-1 text-[10px]"
        title={`Última salida nuestra ${relativeTime(waitingSince)}`}
      >
        <Hourglass className="size-2.5 shrink-0" aria-hidden />
        <span className="truncate">Esperando respuesta {relativeTime(waitingSince)}</span>
      </span>
    ) : null;

  if (state === "missing") {
    return (
      <div className="flex min-w-0 flex-col gap-0.5 pl-8">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
          <CalendarPlus className="size-2.5 shrink-0" aria-hidden />
          Sin próxima acción
        </span>
        {waiting}
      </div>
    );
  }

  if (!next) return null;
  const tone =
    state === "overdue"
      ? "font-medium text-red-600 dark:text-red-400"
      : state === "today"
        ? "font-medium text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <div className="flex min-w-0 flex-col gap-0.5 pl-8">
      <span
        className={cn("inline-flex min-w-0 items-center gap-1 text-[10px]", tone)}
        title={`${next.title} · ${relativeTime(next.remind_at)}`}
      >
        <CalendarClock className="size-2.5 shrink-0" aria-hidden />
        <span className="truncate">
          {state === "overdue" ? "Vencido " : ""}
          {relativeTime(next.remind_at)} · {next.title}
        </span>
      </span>
      {waiting}
    </div>
  );
}

function MemberFilterPopover({ member }: { member: LeadMemberRef }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filterByAssignee = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("assignee", member.id);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  };

  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      <PopoverButton
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={`Opciones de ${member.name}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="focus-visible:ring-ring/50 shrink-0 rounded-full focus-visible:ring-2 focus-visible:outline-none"
      >
        <MemberAvatar member={member} size="sm" className="size-5 shrink-0" />
      </PopoverButton>
      <PopoverContent
        placement="bottom end"
        className="w-56 p-2"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-1 py-1.5">
          <MemberAvatar member={member} size="default" className="size-8" />
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-semibold">{member.name}</p>
            <p className="text-muted-foreground text-xs">Responsable del lead</p>
          </div>
        </div>
        <Link
          href={`/team/${member.id}`}
          className="text-foreground hover:bg-muted mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
        >
          <User className="size-3.5" aria-hidden />
          Ver perfil
        </Link>
        <button
          type="button"
          onClick={filterByAssignee}
          className="text-foreground hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
        >
          <Filter className="size-3.5" aria-hidden />
          Filtrar sus tareas
        </button>
      </PopoverContent>
    </PopoverTrigger>
  );
}

function RecentActivity({ lead }: { lead: KanbanLead }) {
  const [open, setOpen] = useState(false);
  const interactions = lead.recent_interactions;
  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="Últimas acciones"
          title="Últimas acciones"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring/50 inline-flex size-4 shrink-0 items-center justify-center rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <HistoryIcon className="size-3" aria-hidden />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-72 p-2.5"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-foreground mb-1.5 text-xs font-semibold">Últimas acciones</p>
        {interactions.length === 0 ? (
          <p className="text-muted-foreground/80 text-[11px]">Sin interacciones registradas.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {interactions.slice(0, 3).map((i) => (
              <li key={i.id} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-foreground font-medium">
                    {INTERACTION_LABEL[i.type] ?? i.type}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {relativeTime(i.created_at)}
                  </span>
                </div>
                {i.subject ? (
                  <p className="text-muted-foreground line-clamp-2 text-[11px]">{i.subject}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
