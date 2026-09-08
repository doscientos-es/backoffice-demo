import { render } from '@react-email/components'
import type { ReactElement } from 'react'

/**
 * Renders a React Email component tree into an HTML string ready to be
 * passed to `sendEmail({ html })`.
 *
 * @example
 *   import { renderEmail } from "@/lib/email/render";
 *   import { InvoiceEmail } from "@/components/email";
 *
 *   const html = await renderEmail(
 *     <InvoiceEmail
 *       clientName="Acme S.L."
 *       invoiceNumber="A-000042"
 *       total="1.250,00 €"
 *       dueDate="15 de junio de 2026"
 *       portalUrl="https://app.doscientos.es/p/invoice/abc123"
 *       appUrl="https://app.doscientos.es"
 *     />
 *   );
 *   await sendEmail({ ..., html });
 */
export async function renderEmail(element: ReactElement): Promise<string> {
  return render(element)
}
