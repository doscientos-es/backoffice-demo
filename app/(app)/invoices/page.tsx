import {
  Activity,
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle2,
  Clock,
  KeyRound,
  RefreshCcw,
  Send,
  ShieldAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ListPage } from "@/components/layout/list-page";
import { StatCard } from "@/components/layout/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { listInvoices } from "@/lib/invoices/queries";
import { INVOICE_LIST_PAGE_SIZE, INVOICE_SORT_COLUMNS } from "@/lib/invoices/types";
import { INVOICE_STATUS, VERIFACTU_STATUS } from "@/lib/status";
import { formatDate, formatEUR } from "@/lib/utils";
import { parsePage, parseSortParam, parseStringParam } from "@/lib/utils/search-params";
import { getVerifactuOperationalHealth } from "@/lib/verifactu/health";

import { InvoiceRegisterExport } from "./monthly-register-export";

export const metadata: Metadata = { title: "Facturas · doscientos" };
export const dynamic = "force-dynamic";

const STATUS_FILTER_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "issued", label: "Emitida" },
  { value: "paid", label: "Pagada" },
  { value: "overdue", label: "Vencida" },
  { value: "cancelled", label: "Anulada" },
];

const VERIFACTU_FILTER_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "submitted", label: "Enviada" },
  { value: "accepted", label: "Aceptada" },
  { value: "error", label: "Error técnico" },
  { value: "rejected", label: "Rechazada" },
  { value: "excluded", label: "Excluida" },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  const q = parseStringParam(sp, "q");
  const status = parseStringParam(sp, "status");
  const verifactu = parseStringParam(sp, "verifactu");
  const page = parsePage(sp);
  const { sort, dir } = parseSortParam(sp, INVOICE_SORT_COLUMNS, "issue_date", "desc");

  const [{ data, count, stats, error }, aeatHealth] = await Promise.all([
    listInvoices({ q, status, verifactu, page, sort, dir }),
    getVerifactuOperationalHealth(),
  ]);

  const {
    pendingTotal,
    pendingCount,
    overdueTotal,
    overdueCount,
    paidMonthTotal,
    verifactuKoCount,
  } = stats;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  return (
    <ListPage
      title="Facturas"
      description="Consulta el estado de cobro y el envío de cada factura a Verifactu."
      summary={
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Pendientes de cobro"
              value={formatEUR(pendingTotal)}
              density="compact"
              tone="info"
              icon={Clock}
              hint={`${pendingCount} ${pendingCount === 1 ? "factura emitida" : "facturas emitidas"}`}
              href="/invoices?status=issued"
            />
            <StatCard
              label="Vencidas"
              value={formatEUR(overdueTotal)}
              density="compact"
              tone="danger"
              icon={AlertTriangle}
              hint={`${overdueCount} ${overdueCount === 1 ? "factura vencida" : "facturas vencidas"}`}
              href="/invoices?status=overdue"
            />
            <StatCard
              label="Cobrado este mes"
              value={formatEUR(paidMonthTotal)}
              density="compact"
              tone="success"
              icon={CheckCircle2}
              hint={`Desde ${formatDate(monthStart)}`}
            />
            <StatCard
              label="Verifactu KO"
              value={verifactuKoCount}
              density="compact"
              tone={verifactuKoCount > 0 ? "danger" : "default"}
              icon={ShieldAlert}
              hint="Rechazadas por AEAT"
              href="/invoices?verifactu=rejected"
            />
          </div>
          <section aria-labelledby="aeat-health-title" className="space-y-1.5">
            <h2 id="aeat-health-title" className="text-xs font-semibold">
              Salud operativa AEAT
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Cola pendiente"
                value={aeatHealth.queueAvailable ? aeatHealth.pending : "—"}
                density="compact"
                tone={aeatHealth.pending > 0 ? "warning" : "default"}
                icon={Send}
                hint="En espera o procesando"
              />
              <StatCard
                label="Reintentos"
                value={aeatHealth.queueAvailable ? aeatHealth.retrying : "—"}
                density="compact"
                tone={aeatHealth.retrying > 0 ? "warning" : "default"}
                icon={RefreshCcw}
                hint="Errores técnicos recuperables"
                href="/invoices?verifactu=error"
              />
              <StatCard
                label="Bloqueadas"
                value={aeatHealth.queueAvailable ? aeatHealth.blocked : "—"}
                density="compact"
                tone={aeatHealth.blocked > 0 ? "danger" : "default"}
                icon={AlertTriangle}
                hint="Rechazo o error definitivo"
                href="/invoices?verifactu=rejected"
              />
              <StatCard
                label="Diagnóstico AEAT"
                value={aeatHealth.diagnostic.status === "passed" ? "Vigente" : "Revisar"}
                density="compact"
                tone={aeatHealth.diagnostic.status === "passed" ? "success" : "danger"}
                icon={Activity}
                hint="Suite sintética obligatoria"
                href="/settings/diagnostics"
              />
              <StatCard
                label="Certificado"
                value={
                  aeatHealth.certificate.daysRemaining === null
                    ? "Sin fecha"
                    : `${aeatHealth.certificate.daysRemaining} días`
                }
                density="compact"
                tone={
                  aeatHealth.certificate.status === "ok"
                    ? "success"
                    : aeatHealth.certificate.status === "warning"
                      ? "warning"
                      : "danger"
                }
                icon={KeyRound}
                hint="Vigencia del certificado P12"
                href="/settings"
              />
            </div>
          </section>
        </div>
      }
      empty={q || status || verifactu ? "Sin coincidencias." : "Aún no hay facturas."}
      error={error ?? undefined}
      searchKey="q"
      searchPlaceholder="Buscar por cliente, nº o IDFACT…"
      actions={<InvoiceRegisterExport year={now.getFullYear()} />}
      filters={[
        { key: "status", label: "Estado", options: STATUS_FILTER_OPTIONS },
        { key: "verifactu", label: "Verifactu", options: VERIFACTU_FILTER_OPTIONS },
      ]}
      pagination={{ page, pageSize: INVOICE_LIST_PAGE_SIZE, total: count }}
      headers={[
        { label: "Nº", sortKey: "full_number", minWidth: "8rem" },
        { label: "Cliente", sortKey: "client_name", minWidth: "11rem" },
        { label: "Conceptos", minWidth: "15rem" },
        { label: "IDFACT", minWidth: "7rem" },
        { label: "Estado", sortKey: "status" },
        "Verifactu",
        { label: "Importe", align: "right", sortKey: "total" },
        { label: "Emisión", sortKey: "issue_date", minWidth: "7rem" },
        { label: "Vencimiento", sortKey: "due_date", minWidth: "7rem" },
      ]}
      align={["left", "left", "left", "left", "left", "left", "right", "left", "left"]}
      exportFilename="facturas"
      rows={data.map((i) => ({
        id: i.id,
        href: `/invoices/${i.id}`,
        cells: [
          <span key="number" className="font-semibold whitespace-nowrap tabular-nums">
            {i.full_number ?? (i.status === "draft" ? "Borrador" : "—")}
          </span>,
          i.client_name ? (
            <Link
              key="client"
              href={`/clients/${i.client_id}`}
              className="text-foreground hover:text-primary block max-w-48 transition-colors hover:underline"
              title={`Abrir ficha de ${i.client_name}`}
            >
              <span className="line-clamp-2 text-sm leading-5 font-medium">{i.client_name}</span>
            </Link>
          ) : null,
          i.concepts.length > 0 ? (
            <span
              key="concepts"
              className="text-foreground/80 line-clamp-2 max-w-80 text-sm leading-5"
              title={i.concepts.join("\n")}
            >
              {i.concepts.join(" · ")}
            </span>
          ) : null,
          i.idfact ? (
            <span
              key="idfact"
              className="text-muted-foreground line-clamp-2 max-w-28 font-mono text-[10px] leading-4 break-all"
              title={i.idfact}
            >
              {i.idfact}
            </span>
          ) : (
            <span key="idfact" className="text-muted-foreground/50">
              —
            </span>
          ),
          <StatusBadge key="status" meta={INVOICE_STATUS} value={i.status ?? ""} />,
          <StatusBadge key="verifactu" meta={VERIFACTU_STATUS} value={i.verifactu_status ?? ""} />,
          <span key="total" className="text-foreground font-medium whitespace-nowrap tabular-nums">
            {formatEUR(i.total ?? 0)}
          </span>,
          <span key="issue-date" className="whitespace-nowrap tabular-nums">
            {formatDate(i.issue_date)}
          </span>,
          <span key="due-date" className="whitespace-nowrap tabular-nums">
            {formatDate(i.due_date)}
          </span>,
        ],
        csvValues: [
          i.full_number ?? "",
          i.client_name ?? "",
          i.concepts.join(" | "),
          i.idfact ?? "",
          i.status ?? "",
          i.verifactu_status ?? "",
          i.total ?? 0,
          i.issue_date ?? "",
          i.due_date ?? "",
        ],
      }))}
    />
  );
}
