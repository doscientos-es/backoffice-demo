"use client";

import { CalendarClock } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toDatetimeLocalValue } from "@/lib/utils/date-time";

type Preset = { id: string; label: string; days: number };

const PRESETS: Preset[] = [
  { id: "tomorrow", label: "Mañana", days: 1 },
  { id: "in3", label: "En 3 días", days: 3 },
  { id: "week", label: "Próxima semana", days: 7 },
];

/** Same hour of the day the team usually starts calling (09:00 local). */
export function nextCallPresetValue(
  days: number,
  now: Date = new Date(),
): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return toDatetimeLocalValue(date);
}

function describe(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day[0]?.toUpperCase()}${day.slice(1)} a las ${time}`;
}

export function NextCallSection({
  idPrefix,
  enabled,
  onEnabledChange,
  value,
  onChange,
}: {
  idPrefix: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  value: string;
  onChange: (v: string) => void;
}) {
  const isPast = enabled && new Date(value).getTime() <= Date.now();
  const summary = describe(value);

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-md border p-2.5 transition-colors",
        enabled
          ? "border-violet-500/40 bg-violet-500/5"
          : "border-border/60 bg-muted/30",
      )}
    >
      <label
        htmlFor={`${idPrefix}-enabled`}
        className="flex items-start gap-2 text-xs"
      >
        <Checkbox
          id={`${idPrefix}-enabled`}
          isSelected={enabled}
          onChange={onEnabledChange}
        />
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 font-medium">
            <CalendarClock className="size-3.5 text-violet-600 dark:text-violet-400" />
            Agendar próxima llamada
          </span>
          {!enabled ? (
            <span className="text-muted-foreground">
              El lead pasará a «Reunión agendada» hasta esa fecha.
            </span>
          ) : null}
        </span>
      </label>
      {enabled ? (
        <>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Fechas rápidas"
          >
            {PRESETS.map((preset) => {
              const presetValue = nextCallPresetValue(preset.days);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChange(presetValue)}
                  aria-pressed={value === presetValue}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    value === presetValue
                      ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <Input
            id={`${idPrefix}-at`}
            type="datetime-local"
            aria-label="Fecha y hora de la próxima llamada"
            value={value}
            min={toDatetimeLocalValue(new Date())}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-xs"
          />
          {isPast ? (
            <p className="text-xs text-destructive" role="alert">
              Elige una fecha futura para poder agendarla.
            </p>
          ) : summary ? (
            <p className="text-xs text-muted-foreground">
              {summary} · pasará a «Reunión agendada».
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
