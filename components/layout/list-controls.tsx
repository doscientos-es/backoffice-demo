"use client";

import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { Input } from "@/components/ui/input";
import { type AvatarMember, MemberAvatar } from "@/components/ui/member-avatar";
import { Button as PopoverButton, PopoverContent, PopoverTrigger } from "@doscientos/ui";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string; avatar?: AvatarMember };

export type FilterConfig = {
  key: string;
  label: string;
  options: FilterOption[];
  searchable?: boolean;
  display?: "select" | "avatars";
};

export type SavedViewsConfig = {
  /** Browser-only storage key. Views are local to the current device and browser. */
  storageKey: string;
  /** URL parameters that define the saved filter state. */
  filterKeys: string[];
};

export type ListControlsProps = {
  searchKey?: string;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
  /** Override classes on the root container (e.g. to remove border-b). */
  className?: string;
  /** Presentación visual del bloque de búsqueda y filtros. */
  presentation?: "default" | "panel";
  /** Si se provee, muestra un botón "Exportar CSV" que llama este callback. */
  onExport?: () => void;
  /** Optional browser-local saved filter views. */
  savedViews?: SavedViewsConfig;
};

type SavedView = { id: string; name: string; filters: Record<string, string> };

function updateParams(
  current: URLSearchParams,
  updates: Record<string, string | null>,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
  }
  return next;
}

function readSavedViews(storageKey: string): SavedView[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item): SavedView[] => {
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      if (typeof value.id !== "string" || typeof value.name !== "string") return [];
      const filters = value.filters;
      if (!filters || typeof filters !== "object" || Array.isArray(filters)) return [];
      return [
        {
          id: value.id,
          name: value.name.slice(0, 60),
          filters: Object.fromEntries(
            Object.entries(filters).filter(
              ([key, filterValue]) => typeof key === "string" && typeof filterValue === "string",
            ),
          ),
        },
      ];
    });
  } catch {
    return [];
  }
}

function writeSavedViews(storageKey: string, views: SavedView[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(views));
  } catch {
    // Saved views remain optional if browser storage is unavailable.
  }
}

function SavedViewsMenu({
  views,
  hasActiveFilters,
  saving,
  name,
  onStartSaving,
  onCancelSaving,
  onNameChange,
  onSave,
  onApply,
  onDelete,
}: {
  views: SavedView[];
  hasActiveFilters: boolean;
  saving: boolean;
  name: string;
  onStartSaving: () => void;
  onCancelSaving: () => void;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onApply: (view: SavedView) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <PopoverTrigger>
      <PopoverButton type="button" size="sm" variant="outline" className="h-9 shrink-0">
        <Bookmark className="size-3.5" />
        Vistas
        {views.length > 0 ? (
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-px text-[10px] leading-4">
            {views.length}
          </span>
        ) : null}
      </PopoverButton>
      <PopoverContent placement="bottom start" className="w-[min(22rem,calc(100vw-2rem))] p-3">
        <div className="mb-3">
          <p className="text-sm font-semibold">Vistas guardadas</p>
          <p className="text-muted-foreground text-xs">Se guardan solo en este navegador.</p>
        </div>
        {views.length > 0 ? (
          <div className="mb-3 space-y-1">
            {views.map((view) => (
              <div key={view.id} className="hover:bg-muted/60 flex items-center gap-1 rounded-md">
                <button
                  type="button"
                  onClick={() => onApply(view)}
                  className="focus-visible:ring-ring/50 min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                >
                  {view.name}
                </button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => onDelete(view.id)}
                  aria-label={`Eliminar vista ${view.name}`}
                  title={`Eliminar ${view.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="bg-muted/50 text-muted-foreground mb-3 rounded-md px-2 py-3 text-xs">
            Guarda un conjunto de filtros para recuperarlo con un clic.
          </p>
        )}
        {saving ? (
          <div className="flex gap-2">
            <Input
              autoFocus
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSave();
                if (event.key === "Escape") onCancelSaving();
              }}
              aria-label="Nombre de la vista"
              placeholder="Ej. Mis leads calientes"
              maxLength={60}
              className="h-9"
            />
            <Button type="button" size="sm" onClick={onSave} disabled={!name.trim()}>
              Guardar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={onStartSaving}
            disabled={!hasActiveFilters}
            title={hasActiveFilters ? undefined : "Aplica algún filtro antes de guardar una vista"}
          >
            <Save className="size-3.5" />
            Guardar filtros actuales
          </Button>
        )}
      </PopoverContent>
    </PopoverTrigger>
  );
}

export function ListControls({
  searchKey = "q",
  searchPlaceholder = "Buscar…",
  filters = [],
  pagination,
  className,
  presentation = "default",
  onExport,
  savedViews: savedViewsConfig,
}: ListControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const urlQ = params.get(searchKey) ?? "";
  const [q, setQ] = useState(urlQ);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [isSavingView, setIsSavingView] = useState(false);
  const [savedViewName, setSavedViewName] = useState("");
  const managedFilterKeys = useMemo(
    () => [
      ...new Set([
        searchKey,
        ...filters.map((filter) => filter.key),
        ...(savedViewsConfig?.filterKeys ?? []),
      ]),
    ],
    [filters, savedViewsConfig?.filterKeys, searchKey],
  );

  useEffect(() => {
    setSavedViews(savedViewsConfig ? readSavedViews(savedViewsConfig.storageKey) : []);
    setIsSavingView(false);
    setSavedViewName("");
  }, [savedViewsConfig]);

  // Keep the latest router-related callbacks in a ref so the debounce effect
  // can depend only on `q` without re-creating the timeout on every render.
  const commitRef = useRef<(value: string) => void>(() => {});
  commitRef.current = (value: string) => {
    const next = updateParams(params, { [searchKey]: value, page: null });
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // Sync local input when the URL changes externally (back/forward, links).
  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  // Debounce input → URL.
  useEffect(() => {
    if (q === urlQ) return;
    const handle = setTimeout(() => commitRef.current(q), 250);
    return () => clearTimeout(handle);
  }, [q, urlQ]);

  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = updateParams(params, { [key]: value || null, page: null });
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const setPage = useCallback(
    (page: number) => {
      const next = updateParams(params, { page: page <= 1 ? null : String(page) });
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    for (const key of [...managedFilterKeys, "page"]) next.delete(key);
    setQ("");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [managedFilterKeys, params, pathname, router]);

  const applySavedView = useCallback(
    (view: SavedView) => {
      if (!savedViewsConfig) return;
      const next = new URLSearchParams(params.toString());
      for (const key of savedViewsConfig.filterKeys) next.delete(key);
      for (const [key, value] of Object.entries(view.filters)) next.set(key, value);
      next.delete("page");
      setQ(view.filters[searchKey] ?? "");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router, savedViewsConfig, searchKey],
  );

  const saveCurrentView = useCallback(() => {
    if (!savedViewsConfig) return;
    const name = savedViewName.trim();
    if (!name) return;
    const filters: Record<string, string> = {};
    for (const key of savedViewsConfig.filterKeys) {
      const value = params.get(key);
      if (value) filters[key] = value;
    }
    if (Object.keys(filters).length === 0) return;
    const id = globalThis.crypto?.randomUUID?.() ?? `view-${Date.now()}`;
    setSavedViews((current) => {
      const next = [...current, { id, name: name.slice(0, 60), filters }];
      writeSavedViews(savedViewsConfig.storageKey, next);
      return next;
    });
    setSavedViewName("");
    setIsSavingView(false);
  }, [params, savedViewName, savedViewsConfig]);

  const deleteSavedView = useCallback(
    (id: string) => {
      if (!savedViewsConfig) return;
      setSavedViews((current) => {
        const next = current.filter((view) => view.id !== id);
        writeSavedViews(savedViewsConfig.storageKey, next);
        return next;
      });
    },
    [savedViewsConfig],
  );

  const hasActiveFilters = managedFilterKeys.some((key) => Boolean(params.get(key)));
  const isPanel = presentation === "panel";
  const activeFilters = filters.flatMap((filter) => {
    const value = params.get(filter.key);
    if (!value) return [];
    const option = filter.options.find((item) => item.value === value);
    return option ? [{ key: filter.key, label: `${filter.label}: ${option.label}` }] : [];
  });
  const avatarFilters = filters.filter((filter) => filter.display === "avatars");
  const secondaryFilters = filters.filter((filter) => filter.display !== "avatars");
  const activeSecondaryFilterCount = secondaryFilters.filter((filter) =>
    Boolean(params.get(filter.key)),
  ).length;

  const hasControls = searchKey || filters.length > 0;
  const hasPagination =
    pagination && pagination.total > 0 && pagination.total > pagination.pageSize;

  if (!hasControls && !hasPagination) return null;

  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;
  const from = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const to = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : 0;
  const savedViewsMenu = savedViewsConfig ? (
    <SavedViewsMenu
      views={savedViews}
      hasActiveFilters={hasActiveFilters}
      saving={isSavingView}
      name={savedViewName}
      onStartSaving={() => setIsSavingView(true)}
      onCancelSaving={() => {
        setSavedViewName("");
        setIsSavingView(false);
      }}
      onNameChange={setSavedViewName}
      onSave={saveCurrentView}
      onApply={applySavedView}
      onDelete={deleteSavedView}
    />
  ) : null;

  if (isPanel) {
    return (
      <div className={cn("rounded-xl border border-border bg-card shadow-xs", className)}>
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
          {searchKey ? (
            <div className="relative w-full min-w-0 sm:w-auto sm:max-w-sm sm:min-w-60 sm:flex-1">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="border-border bg-background focus-visible:ring-primary/25 h-9 rounded-lg pr-8 pl-10! text-sm shadow-xs"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}

          {avatarFilters.map((filter) => {
            const selectedValue = params.get(filter.key) ?? "";
            return (
              <div
                key={filter.key}
                className="border-border bg-background flex h-9 shrink-0 items-center gap-1 rounded-lg border px-1.5 shadow-xs"
              >
                {filter.options.map((option) => {
                  const isSelected = selectedValue === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={
                        isSelected
                          ? `Quitar filtro de ${option.label}`
                          : `Filtrar por ${option.label}`
                      }
                      title={option.label}
                      onClick={() => setFilter(filter.key, isSelected ? "" : option.value)}
                      className="focus-visible:ring-ring/50 rounded-full focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <MemberAvatar
                        member={option.avatar ?? null}
                        size="sm"
                        className={cn(
                          "transition-all",
                          isSelected
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "opacity-60 hover:scale-105 hover:opacity-100",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            );
          })}

          {secondaryFilters.length > 0 ? (
            <PopoverTrigger>
              <PopoverButton
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "h-9 shrink-0",
                  activeSecondaryFilterCount > 0 && "border-primary/30 bg-primary/5 text-primary",
                )}
              >
                <SlidersHorizontal className="size-3.5" />
                Filtros
                {activeSecondaryFilterCount > 0 ? (
                  <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-px text-[10px] leading-4">
                    {activeSecondaryFilterCount}
                  </span>
                ) : null}
              </PopoverButton>
              <PopoverContent
                placement="bottom start"
                className="w-[min(22rem,calc(100vw-2rem))] p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Filtrar el listado</p>
                    <p className="text-muted-foreground text-xs">
                      Acota los resultados por sus atributos.
                    </p>
                  </div>
                  {hasActiveFilters ? (
                    <Button type="button" variant="ghost" size="xs" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {secondaryFilters.map((filter) => {
                    const selectedValue = params.get(filter.key) ?? "";
                    return filter.searchable ? (
                      <div
                        key={filter.key}
                        className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2"
                      >
                        <span className="text-muted-foreground text-xs font-medium">
                          {filter.label}
                        </span>
                        <EntityCombobox
                          items={filter.options.map((option) => ({
                            id: option.value,
                            label: option.label,
                          }))}
                          value={selectedValue}
                          onChange={(value) => setFilter(filter.key, value)}
                          placeholder={`${filter.label}: todos`}
                          aria-label={filter.label}
                          className="h-9 text-xs"
                        />
                      </div>
                    ) : (
                      <div
                        key={filter.key}
                        className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2"
                      >
                        <span className="text-muted-foreground text-xs font-medium">
                          {filter.label}
                        </span>
                        <Select
                          value={selectedValue}
                          onChange={(event) => setFilter(filter.key, event.target.value)}
                          aria-label={filter.label}
                          className="h-9 text-xs"
                        >
                          <option value="">Todos</option>
                          {filter.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </PopoverTrigger>
          ) : null}

          {savedViewsMenu}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {hasActiveFilters ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={clearFilters}
                aria-label="Limpiar todos los filtros"
                title="Limpiar filtros"
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
            {onExport ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={onExport}
                aria-label="Exportar CSV"
                title="Exportar CSV"
              >
                <Download className="size-3.5" />
              </Button>
            ) : null}
            {pagination ? (
              <>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {pagination.total === 0
                    ? "Sin resultados"
                    : `${from}–${to} de ${pagination.total}`}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(pagination.page - 1)}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pagination.page >= totalPages}
                  onClick={() => setPage(pagination.page + 1)}
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col",
        isPanel ? "rounded-xl border border-border bg-card shadow-xs" : "border-b border-border",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center",
          isPanel
            ? "flex-col items-stretch gap-3 p-3 sm:p-4 lg:flex-row lg:items-center"
            : "gap-2 px-3 py-2",
        )}
      >
        {searchKey ? (
          <div
            className={cn(
              "relative w-full min-w-32 flex-1",
              isPanel ? "max-w-none lg:max-w-sm" : "sm:max-w-56",
            )}
          >
            <Search
              className={cn(
                "pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground",
                isPanel && "size-4",
              )}
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                "text-sm",
                isPanel
                  ? "h-9 rounded-lg border-border bg-background pl-10! pr-8 shadow-xs focus-visible:ring-primary/25"
                  : "h-8 pl-10!",
              )}
            />
            {isPanel && q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-2",
            isPanel && "grid w-full grid-cols-1 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-1",
          )}
        >
          {isPanel ? (
            <span className="text-muted-foreground col-span-full inline-flex items-center gap-1 text-xs font-medium">
              <SlidersHorizontal className="size-3.5" aria-hidden />
              Filtros
            </span>
          ) : null}
          {filters.map((f) => {
            const selectedValue = params.get(f.key) ?? "";

            if (f.display === "avatars") {
              return (
                <div
                  key={f.key}
                  className={cn(
                    "flex items-center gap-1",
                    isPanel &&
                      "min-h-9 w-full rounded-lg border border-border bg-background px-2 shadow-xs lg:w-auto",
                  )}
                >
                  <span className="text-muted-foreground mr-0.5 text-xs font-medium">
                    {f.label}
                  </span>
                  {f.options.map((option) => {
                    const isSelected = selectedValue === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={
                          isSelected
                            ? `Quitar filtro de ${option.label}`
                            : `Filtrar por ${option.label}`
                        }
                        title={option.label}
                        onClick={() => setFilter(f.key, isSelected ? "" : option.value)}
                        className="focus-visible:ring-ring/50 rounded-full focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <MemberAvatar
                          member={option.avatar ?? null}
                          size="sm"
                          className={cn(
                            "transition-all",
                            isSelected
                              ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                              : "opacity-60 hover:scale-105 hover:opacity-100",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              );
            }

            return f.searchable ? (
              <EntityCombobox
                key={f.key}
                items={f.options.map((o) => ({ id: o.value, label: o.label }))}
                value={selectedValue}
                onChange={(value) => setFilter(f.key, value)}
                placeholder={`${f.label}: todos`}
                aria-label={f.label}
                className={cn(
                  "min-w-30 max-w-45 flex-1 text-xs sm:flex-none",
                  isPanel &&
                    "h-9 w-full max-w-none rounded-lg border-border bg-background shadow-xs lg:w-auto lg:max-w-45",
                  !isPanel && "h-8",
                )}
              />
            ) : (
              <Select
                key={f.key}
                value={selectedValue}
                onChange={(e) => setFilter(f.key, e.target.value)}
                aria-label={f.label}
                className={cn(
                  "min-w-30 max-w-45 flex-1 text-xs font-medium sm:flex-none",
                  isPanel && [
                    "h-9 w-full max-w-none rounded-lg border-border bg-background shadow-xs hover:border-primary/30 lg:w-auto lg:max-w-45",
                    selectedValue && "border-primary/30 bg-primary/5 text-primary",
                  ],
                  !isPanel && "h-8",
                )}
              >
                <option value="">{f.label}: todos</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            );
          })}
          {savedViewsMenu}
        </div>

        <div
          className={cn(
            "ml-auto flex shrink-0 items-center gap-1",
            isPanel && "w-full justify-end lg:w-auto",
          )}
        >
          {hasActiveFilters ? (
            <Button
              type="button"
              size="sm"
              variant={isPanel ? "outline" : "ghost"}
              className={cn("text-xs text-muted-foreground", isPanel ? "h-9" : "h-8")}
              onClick={clearFilters}
            >
              <X className="size-3.5" />
              Limpiar
            </Button>
          ) : null}
          {onExport ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={onExport}
              aria-label="Exportar CSV"
              title="Exportar CSV"
            >
              <Download className="size-3.5" />
            </Button>
          ) : null}
          {pagination ? (
            <>
              <span className="text-muted-foreground text-xs tabular-nums">
                {pagination.total === 0 ? "Sin resultados" : `${from}–${to} de ${pagination.total}`}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pagination.page <= 1}
                onClick={() => setPage(pagination.page - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pagination.page >= totalPages}
                onClick={() => setPage(pagination.page + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {isPanel && activeFilters.length > 0 ? (
        <div className="border-border/70 flex flex-wrap items-center gap-1.5 border-t px-3 py-2 sm:px-4">
          <span className="text-muted-foreground mr-1 text-xs">Activos:</span>
          {urlQ ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setFilter(searchKey, "");
              }}
              className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              Búsqueda: {urlQ}
              <X className="size-3" aria-hidden />
            </button>
          ) : null}
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setFilter(filter.key, "")}
              className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {filter.label}
              <X className="size-3" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
