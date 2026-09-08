"use client";

import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Globe2,
  Loader2,
  RefreshCw,
  Search,
  Sparkle as Sparkles,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Source = { title: string; url: string; excerpt: string };
type Research = {
  domain: string;
  description: string;
  sector: string | null;
  services: string[];
  location: string | null;
  company_size: string | null;
  fit: string;
  priority: "high" | "medium" | "low";
  confidence: number;
  reasons: string[];
  cautions: string[];
  sources: Source[];
};
type FeedItem = { label: string; url?: string };

const PRIORITY = {
  high: { label: "Prioridad alta", variant: "danger" },
  medium: { label: "Prioridad media", variant: "warning" },
  low: { label: "Prioridad baja", variant: "info" },
} as const;

function hasCorporateEmail(email: string | null): boolean {
  const domain = email?.trim().toLowerCase().split("@")[1];
  return Boolean(
    domain &&
    !["gmail.com", "hotmail.com", "hotmail.es", "outlook.com", "yahoo.com", "icloud.com"].includes(
      domain,
    ),
  );
}

export function LeadCompanyResearch({
  leadId,
  email,
  canEdit,
  aiEnabled,
  available,
  initialResearch,
  initialResearchedAt,
}: {
  leadId: string;
  email: string | null;
  canEdit: boolean;
  aiEnabled: boolean;
  available: boolean;
  initialResearch: Research | null;
  initialResearchedAt: string | null;
}) {
  const [research, setResearch] = useState(initialResearch);
  const [researchedAt, setResearchedAt] = useState(initialResearchedAt);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runResearch() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setItems([{ label: "Preparando una investigación segura" }]);
    try {
      const response = await fetch("/api/crm/ai/research-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo iniciar la investigación.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";
        for (const message of messages) {
          const event = message.match(/^event: (.+)$/m)?.[1];
          const raw = message.match(/^data: (.+)$/m)?.[1];
          if (!event || !raw) continue;
          const payload = JSON.parse(raw) as {
            label?: string;
            title?: string;
            url?: string;
            error?: string;
            research?: Research;
            researched_at?: string;
          };
          if (event === "progress" && payload.label)
            setItems((current) => [...current, { label: payload.label as string }]);
          if (event === "source" && payload.title && payload.url) {
            setItems((current) => [
              ...current,
              { label: payload.title as string, url: payload.url as string },
            ]);
          }
          if (event === "result" && payload.research) {
            setResearch(payload.research);
            setResearchedAt(payload.researched_at ?? new Date().toISOString());
          }
          if (event === "error")
            throw new Error(payload.error ?? "No se pudo completar la investigación.");
        }
        if (done) break;
      }
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo completar la investigación.");
    } finally {
      setLoading(false);
    }
  }

  const canResearch = available && canEdit && aiEnabled && hasCorporateEmail(email);
  const updated = researchedAt
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(researchedAt),
      )
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
            <Globe2 className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium">Inteligencia de empresa</p>
            <p className="text-muted-foreground text-xs leading-5">
              Datos públicos contrastados, separados de la información declarada por el lead.
            </p>
          </div>
        </div>
        {canResearch ? (
          <Button
            size="sm"
            variant={research ? "outline" : "default"}
            onClick={runResearch}
            disabled={loading}
          >
            {research ? <RefreshCw className="size-3.5" /> : <Sparkles className="size-3.5" />}
            {research ? "Actualizar" : "Investigar empresa"}
          </Button>
        ) : null}
      </div>

      {!research ? (
        <div className="border-border bg-muted/30 text-muted-foreground rounded-xl border border-dashed px-4 py-5 text-sm">
          {!available
            ? "La investigación de empresa estará disponible cuando termine de actualizarse esta sección."
            : aiEnabled && !hasCorporateEmail(email)
              ? "Disponible cuando el lead tenga un email corporativo."
              : aiEnabled
                ? "Aún no se ha investigado esta empresa."
                : "La investigación estará disponible cuando se active la IA interna."}
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-4 duration-500">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={PRIORITY[research.priority].variant}>
              {PRIORITY[research.priority].label}
            </Badge>
            <Badge variant="outline">Confianza {Math.round(research.confidence * 100)}%</Badge>
            {research.sector ? <Badge variant="outline">{research.sector}</Badge> : null}
            {updated ? (
              <span className="text-muted-foreground ml-auto text-xs">Actualizado {updated}</span>
            ) : null}
          </div>
          <p className="text-sm leading-6">{research.description}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Insight label="Encaje potencial" value={research.fit} />
            <Insight
              label="Perfil"
              value={
                [research.location, research.company_size].filter(Boolean).join(" · ") ||
                "Sin confirmar"
              }
            />
          </div>
          {research.services.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {research.services.map((service) => (
                <Badge key={service} variant="outline" className="font-normal">
                  {service}
                </Badge>
              ))}
            </div>
          ) : null}
          <ResearchList title="Por qué puede encajar" items={research.reasons} tone="positive" />
          <ResearchList title="Para validar" items={research.cautions} tone="neutral" />
          <div className="border-border bg-muted/25 rounded-xl border p-3">
            <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
              Fuentes consultadas
            </p>
            <div className="space-y-1.5">
              {research.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:bg-background flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
                >
                  <ExternalLink className="text-muted-foreground size-3 shrink-0" />
                  <span className="truncate">{source.title}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {error ? (
        <p className="text-destructive flex items-center gap-1.5 text-xs">
          <CircleAlert className="size-3.5" />
          {error}
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={(next) => !loading && setOpen(next)}>
        <DialogContent className="gap-5 sm:max-w-lg" showCloseButton={!loading}>
          <div className="bg-primary/10 pointer-events-none absolute -top-16 right-0 size-48 rounded-full blur-3xl" />
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-2">
              <Search className="text-primary size-5" />
              Investigando la empresa
            </DialogTitle>
            <DialogDescription>
              Solo consultamos páginas públicas asociadas al dominio corporativo.
            </DialogDescription>
          </DialogHeader>
          <ol className="relative min-w-0 space-y-2" aria-live="polite">
            {items.map((item, index) => {
              const active = loading && index === items.length - 1;
              return (
                <li
                  key={item.url ?? item.label}
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-1 flex items-start gap-3 rounded-xl border px-3 py-2.5 duration-300",
                    active ? "border-primary/25 bg-primary/5" : "border-border/70 bg-muted/20",
                  )}
                >
                  {active ? (
                    <Loader2 className="text-primary mt-0.5 size-4 shrink-0 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  )}
                  <span className="min-w-0 flex-1 break-words text-sm">{item.label}</span>
                  {item.url ? (
                    <span className="text-muted-foreground max-w-28 break-all text-[11px]">
                      {new URL(item.url).hostname}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <p className="text-muted-foreground relative text-center text-xs">
            La IA sintetiza evidencias; revisa siempre los resultados antes de actuar.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-muted/30 rounded-lg border px-3 py-2.5">
      <p className="text-muted-foreground text-[11px] font-medium">{label}</p>
      <p className="mt-1 text-sm leading-5">{value}</p>
    </div>
  );
}

function ResearchList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "neutral";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm">
            <span
              className={cn(
                "mt-2 size-1.5 shrink-0 rounded-full",
                tone === "positive" ? "bg-emerald-500" : "bg-muted-foreground/60",
              )}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
