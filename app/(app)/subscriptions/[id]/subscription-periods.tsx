"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { INVOICE_STATUS } from "@/lib/status";
import type { PeriodRow } from "@/lib/subscriptions/billing-periods";
import { formatDate, formatEUR } from "@/lib/utils";

import {
  generateNextSubscriptionInvoiceDraft,
  generateSubscriptionInvoicesNow,
} from "../actions";

type Props = {
  subscriptionId: string;
  rows: PeriodRow[];
  /** The user may create drafts (not a viewer). */
  canEdit: boolean;
  /** Subscription is active, so drafts can be generated. */
  isActive: boolean;
  overdueCount: number;
};

export function SubscriptionPeriods({
  subscriptionId,
  rows,
  canEdit,
  isActive,
  overdueCount,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok)
        setError(res.error ?? "Algo ha fallado. Inténtalo de nuevo.");
      else router.refresh();
    });
  }

  const generateOne = () =>
    run(() => generateNextSubscriptionInvoiceDraft({ id: subscriptionId }));
  const generateAll = () =>
    run(() => generateSubscriptionInvoicesNow({ id: subscriptionId }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facturas de la suscripción</CardTitle>
        <CardDescription>
          Las facturas se emiten solas al empezar cada período. Aquí puedes ver
          el estado de cada una y adelantar el borrador si lo necesitas.
        </CardDescription>
        {canEdit && isActive && overdueCount > 1 ? (
          <CardAction>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={generateAll}
            >
              Generar {overdueCount} pendientes
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {canEdit && !isActive ? (
          <p className="text-sm text-muted-foreground">
            La suscripción no está activa: no se generarán facturas hasta que la
            actives.
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Factura</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.start}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(row.start)}
                </TableCell>
                {row.invoice ? (
                  <>
                    <TableCell>
                      <Link
                        href={`/invoices/${row.invoice.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.invoice.full_number ?? "Borrador"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        meta={INVOICE_STATUS}
                        value={row.invoice.status}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatEUR(row.invoice.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/invoices/${row.invoice.id}`}>
                          Ver <ArrowUpRight className="size-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell
                      colSpan={2}
                      className="text-sm text-muted-foreground"
                    >
                      {row.state === "overdue"
                        ? "Pendiente: se generará automáticamente en la próxima ejecución."
                        : `Aún no emitida: se generará automáticamente el ${formatDate(row.start)}.`}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && isActive && row.canGenerate ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={generateOne}
                        >
                          {pending ? "Generando…" : "Generar borrador"}
                        </Button>
                      ) : null}
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
