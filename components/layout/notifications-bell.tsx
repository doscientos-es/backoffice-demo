"use client";

import {
  AtSign,
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  CircleDollarSign,
  Eye,
  File as FileCheck,
  FileX,
  MessageSquare,
  UserPlus,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { markNotificationsRead } from "@/app/(app)/tasks/comment-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty-state";
import { Button as PopoverButton, PopoverContent, PopoverTrigger } from "@doscientos/ui";
import { useBrowserNotifications } from "@/lib/hooks/use-browser-notifications";
import { useWebPush } from "@/lib/hooks/use-web-push";
import { getBrowserClient } from "@/lib/supabase/browser";
import { cn, relativeTime } from "@/lib/utils";

type Notif = {
  id: string;
  body: string | null;
  link: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  read_at: string | null;
  actor: { name: string | null; avatar_url: string | null } | null;
};

type NotifGroup = { key: "today" | "yesterday" | "earlier"; label: string; items: Notif[] };

const EVENT_META: Record<string, { icon: ComponentType<{ className?: string }>; tint: string }> = {
  task_comment: { icon: MessageSquare, tint: "text-blue-500" },
  task_mention: { icon: AtSign, tint: "text-violet-500" },
  task_assigned: { icon: UserPlus, tint: "text-emerald-500" },
  daily_responsibilities: { icon: BellRing, tint: "text-primary" },
  lead_new: { icon: Zap, tint: "text-amber-500" },
  lead_assigned: { icon: UserPlus, tint: "text-blue-500" },
  lead_uncontacted: { icon: BellRing, tint: "text-amber-500" },
  lead_stale: { icon: BellRing, tint: "text-orange-500" },
  lead_at_risk: { icon: BellRing, tint: "text-destructive" },
  lead_follow_up_summary: { icon: BellRing, tint: "text-orange-500" },
  call_pending: { icon: BellRing, tint: "text-amber-500" },
  invoice_paid: { icon: CircleDollarSign, tint: "text-emerald-500" },
  invoice_payment: { icon: CircleDollarSign, tint: "text-emerald-500" },
  invoice_requested: { icon: CircleDollarSign, tint: "text-amber-500" },
  proposal_accepted: { icon: FileCheck, tint: "text-emerald-500" },
  proposal_rejected: { icon: FileX, tint: "text-destructive" },
  proposal_deck_completed: { icon: Eye, tint: "text-violet-500" },
};

/** Human-readable titles for OS-level browser notifications. */
const BROWSER_NOTIF_TITLE: Record<string, string> = {
  lead_new: "🔔 Nuevo lead",
  lead_assigned: "👤 Lead asignado",
  lead_uncontacted: "⏱️ Lead sin contactar",
  lead_stale: "⚠️ Lead sin novedades",
  lead_at_risk: "🚨 Lead en riesgo",
  lead_follow_up_summary: "📋 Leads pendientes",
  call_pending: "📞 Llamada pendiente",
  task_comment: "💬 Nuevo comentario",
  task_mention: "💬 Te han mencionado",
  task_assigned: "✅ Tarea asignada",
  daily_responsibilities: "📋 Tu resumen diario",
  invoice_paid: "💰 Factura cobrada",
  invoice_payment: "💰 Pago recibido",
  invoice_requested: "🧾 Solicitud de facturación",
  proposal_accepted: "✅ Propuesta aceptada",
  proposal_rejected: "❌ Propuesta rechazada",
  proposal_deck_completed: "👀 Propuesta visualizada",
};

function getEventMeta(eventType: string) {
  return EVENT_META[eventType] ?? { icon: Bell, tint: "text-muted-foreground" };
}

function getBrowserTitle(eventType: string) {
  return BROWSER_NOTIF_TITLE[eventType] ?? "Nueva notificación";
}

const LEAD_ACTION_EVENTS = new Set([
  "lead_new",
  "lead_assigned",
  "lead_uncontacted",
  "lead_stale",
  "lead_at_risk",
  "call_pending",
]);

function LeadNotificationActions({ notification }: { notification: Notif }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (notification.entity_type !== "lead" || !LEAD_ACTION_EVENTS.has(notification.event_type)) {
    return null;
  }

  async function loadPhone(): Promise<string | null> {
    if (phone) return phone;
    setLoading(true);
    const { data } = await getBrowserClient()
      .from("leads")
      .select("phone")
      .eq("id", notification.entity_id)
      .maybeSingle();
    const value = (data?.phone as string | null) ?? null;
    setPhone(value);
    setLoading(false);
    return value;
  }

  async function callLead(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const value = await loadPhone();
    if (value) window.location.href = `tel:${value.replace(/[^\d+#*]/g, "")}`;
  }

  async function whatsappLead(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const value = await loadPhone();
    if (value)
      window.open(`https://wa.me/${value.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-1.5 flex gap-1.5">
      <Button type="button" variant="outline" size="xs" onClick={callLead} disabled={loading}>
        Llamar
      </Button>
      <Button type="button" variant="outline" size="xs" onClick={whatsappLead} disabled={loading}>
        WhatsApp
      </Button>
    </div>
  );
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function groupByDay(items: Notif[]): NotifGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  const groups: Record<NotifGroup["key"], Notif[]> = { today: [], yesterday: [], earlier: [] };
  for (const n of items) {
    const t = new Date(n.created_at).getTime();
    if (t >= startOfToday) groups.today.push(n);
    else if (t >= startOfYesterday) groups.yesterday.push(n);
    else groups.earlier.push(n);
  }

  return (
    [
      { key: "today", label: "Hoy" },
      { key: "yesterday", label: "Ayer" },
      { key: "earlier", label: "Anteriores" },
    ] as const
  )
    .map((g) => ({ ...g, items: groups[g.key] }))
    .filter((g) => g.items.length > 0);
}

export function NotificationsBell({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { permission, requestPermission, notify } = useBrowserNotifications();
  const { subscribed, subscribe } = useWebPush();

  const fetchNotifs = useCallback(async () => {
    const supabase = getBrowserClient();
    const { data } = await supabase
      .from("notifications")
      .select(
        "id, body, link, event_type, entity_type, entity_id, created_at, read_at, actor:team_members!actor_id(name, avatar_url)",
      )
      .eq("recipient_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifs((data as unknown as Notif[]) ?? []);
  }, [memberId]);

  useEffect(() => {
    fetchNotifs();
    const supabase = getBrowserClient();
    const ch = supabase
      .channel(`notifs-${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${memberId}`,
        },
        (payload) => {
          fetchNotifs();
          const row = payload.new as {
            event_type?: string;
            body?: string | null;
            link?: string | null;
          };
          if (!subscribed) {
            notify({
              title: getBrowserTitle(row.event_type ?? ""),
              body: row.body ?? undefined,
              tag: row.event_type,
              url: row.link ?? undefined,
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [memberId, fetchNotifs, notify, subscribed]);

  const unread = useMemo(() => notifs.filter((n) => !n.read_at), [notifs]);
  useEffect(() => {
    const badge = navigator as Navigator & {
      clearAppBadge?: () => Promise<void>;
      setAppBadge?: (value?: number) => Promise<void>;
    };
    if (unread.length > 0 && badge.setAppBadge)
      void badge.setAppBadge(unread.length).catch(() => undefined);
    if (unread.length === 0 && badge.clearAppBadge)
      void badge.clearAppBadge().catch(() => undefined);
  }, [unread.length]);
  const groups = useMemo(() => groupByDay(notifs), [notifs]);

  function markAllRead() {
    if (unread.length === 0) return;
    startTransition(async () => {
      await markNotificationsRead({});
      await fetchNotifs();
    });
  }

  function handleItemClick(n: Notif) {
    setOpen(false);
    if (!n.read_at) {
      startTransition(async () => {
        await markNotificationsRead({ ids: [n.id] });
        await fetchNotifs();
      });
    }
    if (n.link) router.push(n.link);
  }

  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      <PopoverButton
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Notificaciones${unread.length > 0 ? ` (${unread.length} sin leer)` : ""}`}
        className="relative border-0"
      >
        <Bell className="text-muted-foreground h-4 w-4" />
        {unread.length > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </PopoverButton>
      <PopoverContent placement="bottom end" offset={8} className="z-50 w-96 p-0">
        <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">Notificaciones</span>
            {unread.length > 0 && (
              <span className="text-muted-foreground text-xs">{unread.length} sin leer</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!subscribed && permission !== "denied" && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={async () => {
                  const result = permission === "default" ? await requestPermission() : permission;
                  if (result === "granted") await subscribe();
                }}
                className="text-xs text-amber-600 hover:text-amber-700"
                title="Activar notificaciones del navegador"
              >
                <BellRing className="size-3" />
                Activar en este dispositivo
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={markAllRead}
              disabled={unread.length === 0 || pending}
              className="text-xs"
            >
              <CheckCheck className="size-3" />
              Marcar leídas
            </Button>
          </div>
        </div>

        {notifs.length === 0 ? (
          <Empty className="border-none p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellOff />
              </EmptyMedia>
              <EmptyTitle>Sin notificaciones</EmptyTitle>
              <EmptyDescription>Aquí verás menciones y comentarios en tus tareas.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="scroll-fade no-scrollbar max-h-96 overflow-y-auto py-1">
            {groups.map((group) => (
              <li key={group.key}>
                <p className="text-muted-foreground px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase">
                  {group.label}
                </p>
                <ul>
                  {group.items.map((n) => {
                    const meta = getEventMeta(n.event_type);
                    const Icon = meta.icon;
                    const isUnread = !n.read_at;
                    const content = (
                      <div
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted/60",
                          isUnread && "bg-primary/5",
                        )}
                      >
                        <div className="relative shrink-0">
                          <Avatar size="sm">
                            {n.actor?.avatar_url ? (
                              <AvatarImage src={n.actor.avatar_url} alt={n.actor.name ?? ""} />
                            ) : null}
                            <AvatarFallback>{initials(n.actor?.name)}</AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-background ring-2 ring-background",
                              meta.tint,
                            )}
                          >
                            <Icon className="size-2.5" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground line-clamp-2 text-xs leading-relaxed">
                            {n.actor?.name ? (
                              <span className="font-medium">{n.actor.name}</span>
                            ) : null}
                            {n.actor?.name && n.body ? " " : ""}
                            <span className={cn(!n.actor?.name && "text-foreground")}>
                              {n.body ?? n.event_type}
                            </span>
                          </p>
                          <span className="text-muted-foreground text-[10px]">
                            {relativeTime(n.created_at)}
                          </span>
                        </div>
                        {isUnread && (
                          <span
                            className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full"
                            role="img"
                            aria-label="Sin leer"
                          />
                        )}
                      </div>
                    );

                    return (
                      <li key={n.id} className="px-1">
                        {n.link ? (
                          <div>
                            <Link
                              href={n.link}
                              onClick={(e) => {
                                e.preventDefault();
                                handleItemClick(n);
                              }}
                              className="focus-visible:ring-ring block rounded-md focus-visible:ring-2 focus-visible:outline-none"
                            >
                              {content}
                            </Link>
                            <LeadNotificationActions notification={n} />
                          </div>
                        ) : (
                          <div>
                            <button
                              type="button"
                              onClick={() => handleItemClick(n)}
                              className="focus-visible:ring-ring block w-full rounded-md focus-visible:ring-2 focus-visible:outline-none"
                            >
                              {content}
                            </button>
                            <LeadNotificationActions notification={n} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </PopoverTrigger>
  );
}
