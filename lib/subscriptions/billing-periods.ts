export type BillingCycle = "monthly" | "quarterly" | "yearly";

export type PeriodInvoice = {
  id: string;
  full_number: string | null;
  subscription_period_start: string | null;
  issue_date: string | null;
  total: number;
  status: string;
};

export type PeriodRow = {
  /** Period start, YYYY-MM-DD. */
  start: string;
  invoice: PeriodInvoice | null;
  /** `overdue`: due already but not invoiced. `upcoming`: due in the future. */
  state: "invoiced" | "overdue" | "upcoming";
  /** Only the next un-invoiced period can be generated (the cursor is sequential). */
  canGenerate: boolean;
};

const MAX_PERIODS = 600;

/** Mirrors the date math of `generate_subscription_invoice` in the database. */
export function nextPeriodStart(start: string, cycle: BillingCycle): string {
  const [y, m, d] = start.split("-").map(Number) as [number, number, number];
  if (cycle === "yearly") return `${y + 1}-01-01`;
  const months = cycle === "quarterly" ? 3 : 1;
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(d, lastDay);
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day))
    .toISOString()
    .slice(0, 10);
}

/**
 * Builds one row per billing period from the subscription start up to and
 * including the first period that is still in the future. Existing invoices
 * are matched by period start; invoices that match no computed period are kept
 * so nothing is ever hidden. Returned newest-first.
 */
export function buildSubscriptionPeriods(input: {
  startDate: string;
  endDate: string | null;
  billingCycle: BillingCycle;
  nextInvoiceDate: string | null;
  status: string;
  invoices: PeriodInvoice[];
  today: string;
}): PeriodRow[] {
  const {
    startDate,
    endDate,
    billingCycle,
    nextInvoiceDate,
    status,
    invoices,
    today,
  } = input;
  const byStart = new Map<string, PeriodInvoice>();
  for (const invoice of invoices) {
    if (invoice.subscription_period_start)
      byStart.set(invoice.subscription_period_start, invoice);
  }

  const starts: string[] = [];
  let cursor = startDate;
  for (let i = 0; i < MAX_PERIODS; i += 1) {
    if (endDate && cursor > endDate) break;
    starts.push(cursor);
    if (cursor > today) break;
    cursor = nextPeriodStart(cursor, billingCycle);
  }
  for (const start of byStart.keys())
    if (!starts.includes(start)) starts.push(start);
  starts.sort();

  return starts
    .map((start): PeriodRow => {
      const invoice = byStart.get(start) ?? null;
      const isNext =
        !invoice && status === "active" && start === nextInvoiceDate;
      return {
        start,
        invoice,
        state: invoice ? "invoiced" : start <= today ? "overdue" : "upcoming",
        canGenerate: isNext,
      };
    })
    .reverse();
}
