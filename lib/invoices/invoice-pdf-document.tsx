import 'server-only'
import {
  Circle,
  Document,
  Image,
  Page,
  Path,
  Rect,
  renderToBuffer,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer'

import { INVOICE_STATUS, type InvoiceStatus } from '@/lib/status'
import { formatDate, formatEUR } from '@/lib/utils'

import type { InvoicePdfData } from './pdf-data'

const BRAND = '#2A4227'
const MUTED = '#71717a'
const FAINT = '#a1a1aa'
const LINE = '#e4e4e7'
const INK = '#18181b'

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 64, paddingHorizontal: 40, fontSize: 9, color: INK },
  fiscalQrHeader: { marginBottom: 10, alignItems: 'flex-start' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandName: { fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: BRAND },
  docType: { marginTop: 4, fontSize: 8, color: FAINT, textTransform: 'uppercase' },
  headerRight: { alignItems: 'flex-end' },
  number: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: INK },
  status: {
    marginTop: 2,
    fontSize: 8,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaRow: { marginTop: 4, fontSize: 8, color: MUTED },
  parties: { flexDirection: 'row', marginTop: 28, gap: 24 },
  party: { flex: 1 },
  label: {
    fontSize: 7,
    color: FAINT,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  partyName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK },
  partyLine: { fontSize: 8, color: MUTED, marginTop: 2 },
  table: { marginTop: 28, borderTopWidth: 1, borderColor: LINE },
  thead: { flexDirection: 'row', borderBottomWidth: 1, borderColor: LINE, paddingVertical: 6 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: LINE, paddingVertical: 7 },
  th: { fontSize: 7, color: FAINT, textTransform: 'uppercase', letterSpacing: 0.5 },
  cDesc: { flex: 1, paddingRight: 8 },
  cNum: { width: 50, textAlign: 'right' },
  cVat: { width: 40, textAlign: 'right' },
  cAmount: { width: 70, textAlign: 'right' },
  totals: { marginTop: 16, alignSelf: 'flex-end', width: 220 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalMuted: { fontSize: 8, color: MUTED },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: LINE,
    marginTop: 4,
    paddingTop: 6,
  },
  grandLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  fiscal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28, gap: 16 },
  fiscalInfo: { flex: 1 },
  mono: { fontFamily: 'Courier', fontSize: 7, color: MUTED, marginTop: 2 },
  qrWrap: { alignItems: 'center' },
  // 88 pt = 31.0 mm. AEAT permits 30–40 mm for printed/viewable invoices.
  qr: { width: 88, height: 88 },
  qrCaption: { fontSize: 7, color: FAINT, marginTop: 3 },
  payment: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f4f4f5',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
  },
  paymentTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  paymentRow: { flexDirection: 'row', marginTop: 3, gap: 4 },
  paymentKey: { fontSize: 8, color: MUTED, width: 90 },
  paymentVal: { fontSize: 8, color: INK, fontFamily: 'Helvetica-Bold', flex: 1 },
  paymentNote: { fontSize: 7, color: FAINT, marginTop: 6 },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderColor: LINE,
    paddingTop: 8,
  },
  footerText: { fontSize: 7, color: FAINT, lineHeight: 1.5 },
  pageTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: INK },
  pageSubtitle: { marginTop: 2, fontSize: 8, color: MUTED },
  wlDate: { width: 62 },
  wlMember: { flex: 1, paddingRight: 8 },
  wlRange: { width: 76 },
  wlHours: { width: 56, textAlign: 'right' },
  wlNote: { flex: 1.4, paddingLeft: 8 },
})

/** Compact "4 h 30 min" style duration used across the work-log views. */
function formatWorkLogHours(hours: number): string {
  const totalMin = Math.round(hours * 60)
  const hrs = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hrs === 0) return `${mins} min`
  if (mins === 0) return `${hrs} h`
  return `${hrs} h ${mins} min`
}

/** Brand mark recreated with react-pdf SVG primitives (matches the green logo asset). */
function BrandMark() {
  return (
    <Svg width={14} height={14} viewBox="0 0 859 858">
      <Rect width="858.204" height="858" fill="#BDFF7B" />
      <Path
        d="M144.518 317.011C174.22 317.011 202.704 328.81 223.706 349.812C244.708 370.814 256.507 399.299 256.507 429C256.507 458.701 244.708 487.186 223.706 508.188C202.704 529.19 174.22 540.989 144.519 540.989H110.5V317.011L144.518 317.011Z"
        fill="#0C110B"
      />
      <Circle cx="389.757" cy="429" r="111.989" fill="#0C110B" />
      <Circle cx="634.996" cy="429" r="111.989" fill="#0C110B" />
    </Svg>
  )
}

function statusLabel(status: string): string {
  return INVOICE_STATUS[status as InvoiceStatus]?.label ?? status
}

/** Professional A4 invoice document mirroring the HTML portal view. */
function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  const { company } = data
  const showPaymentInstructions =
    data.status !== 'cancelled' &&
    Boolean(data.company?.iban || data.dueDate || data.portalUrl || data.paymentTerms)
  return (
    <Document title={`Factura ${data.fullNumber}`} author="doscientos">
      <Page size="A4" style={styles.page}>
        {data.qrDataUrl ? (
          <View style={styles.fiscalQrHeader}>
            <View style={styles.qrWrap}>
              <Image style={styles.qr} src={data.qrDataUrl} />
              <Text style={styles.qrCaption}>VERI*FACTU · Verificar en AEAT</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}>
              <BrandMark />
              <Text style={styles.brandName}>doscientos</Text>
            </View>
            {data.invoiceType ? <Text style={styles.docType}>{data.invoiceType}</Text> : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.number}>{data.fullNumber}</Text>
            <Text style={styles.status}>{statusLabel(data.status)}</Text>
            {data.issueDate ? (
              <Text style={styles.metaRow}>Emitida: {formatDate(data.issueDate)}</Text>
            ) : null}
            {data.dueDate ? (
              <Text style={styles.metaRow}>Vencimiento: {formatDate(data.dueDate)}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.parties}>
          {company ? (
            <View style={styles.party}>
              <Text style={styles.label}>Emitida por</Text>
              <Text style={styles.partyName}>{company.name ?? '—'}</Text>
              {company.nif ? <Text style={styles.partyLine}>NIF: {company.nif}</Text> : null}
              {company.address ? <Text style={styles.partyLine}>{company.address}</Text> : null}
              {company.iban ? <Text style={styles.partyLine}>IBAN: {company.iban}</Text> : null}
            </View>
          ) : null}
          <View style={styles.party}>
            <Text style={styles.label}>Facturado a</Text>
            {data.clientLogoUrl ? (
              <Image
                src={data.clientLogoUrl}
                style={{ width: 40, height: 20, objectFit: 'contain', marginBottom: 4 }}
              />
            ) : null}
            <Text style={styles.partyName}>{data.clientName ?? '—'}</Text>
            {data.clientNif ? <Text style={styles.partyLine}>NIF: {data.clientNif}</Text> : null}
            {data.clientAddress ? <Text style={styles.partyLine}>{data.clientAddress}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.cDesc]}>Descripción</Text>
            <Text style={[styles.th, styles.cNum]}>Cant.</Text>
            <Text style={[styles.th, styles.cNum]}>Precio</Text>
            <Text style={[styles.th, styles.cVat]}>IVA</Text>
            <Text style={[styles.th, styles.cAmount]}>Subtotal</Text>
          </View>
          {data.items.length === 0 ? (
            <View style={styles.row}>
              <Text style={[styles.cDesc, { color: FAINT }]}>Sin líneas.</Text>
            </View>
          ) : (
            data.items.map((item, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: PDF is generated once from a fixed snapshot
              <View key={i} style={styles.row} wrap={false}>
                <Text style={styles.cDesc}>{item.description}</Text>
                <Text style={styles.cNum}>{item.quantity}</Text>
                <Text style={styles.cNum}>{formatEUR(item.unitPrice)}</Text>
                <Text style={styles.cVat}>{item.vatRate}%</Text>
                <Text style={[styles.cAmount, { fontFamily: 'Helvetica-Bold' }]}>
                  {formatEUR(item.subtotal)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalLine}>
            <Text style={styles.totalMuted}>Base imponible</Text>
            <Text style={styles.totalMuted}>{formatEUR(data.subtotal)}</Text>
          </View>
          {data.vatBreakdown.map((row) => (
            <View key={row.rate} style={styles.totalLine}>
              <Text style={styles.totalMuted}>
                IVA {row.rate}% sobre {formatEUR(row.base)}
              </Text>
              <Text style={styles.totalMuted}>{formatEUR(row.tax)}</Text>
            </View>
          ))}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandLabel}>{formatEUR(data.total)}</Text>
          </View>
        </View>

        {showPaymentInstructions ? (
          <View style={styles.payment}>
            <Text style={styles.paymentTitle}>Opciones de pago</Text>

            {data.dueDate ? (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentKey}>Fecha límite</Text>
                <Text style={styles.paymentVal}>{formatDate(data.dueDate)}</Text>
              </View>
            ) : null}

            {data.portalUrl ? (
              <>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentKey}>Forma de pago</Text>
                  <Text style={styles.paymentVal}>Tarjeta o Bizum (pago online)</Text>
                </View>
                <Text style={styles.paymentNote}>
                  Pague online con tarjeta o Bizum en: {data.portalUrl}
                </Text>
              </>
            ) : null}

            {data.company?.iban ? (
              <>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentKey}>Alternativa</Text>
                  <Text style={styles.paymentVal}>Transferencia bancaria</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentKey}>IBAN</Text>
                  <Text style={styles.paymentVal}>{data.company.iban}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentKey}>Beneficiario</Text>
                  <Text style={styles.paymentVal}>{data.company.name ?? '—'}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentKey}>Concepto</Text>
                  <Text style={styles.paymentVal}>Factura {data.fullNumber}</Text>
                </View>
              </>
            ) : null}

            {data.paymentTerms ? <Text style={styles.paymentNote}>{data.paymentTerms}</Text> : null}
          </View>
        ) : null}

        {data.verifactuStatus === 'accepted' && (data.idfact || data.verifactuCsv || data.qrDataUrl) ? (
          <View style={styles.fiscal}>
            <View style={styles.fiscalInfo}>
              <Text style={styles.label}>Datos fiscales</Text>
              {data.idfact ? <Text style={styles.mono}>IDFACT: {data.idfact}</Text> : null}
              {data.verifactuCsv ? (
                <Text style={styles.mono}>CSV AEAT: {data.verifactuCsv}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.qrDataUrl
              ? 'VERI*FACTU · Factura verificable en la sede electrónica de la AEAT mediante el código QR.'
              : data.status === 'draft'
                ? 'Factura en borrador: no constituye un documento fiscal emitido.'
                : 'Factura emitida. No está disponible la verificación mediante código QR.'}
          </Text>
        </View>
      </Page>

      {data.workLogs.length > 0 ? <WorkLogPage data={data} /> : null}
    </Document>
  )
}

/** Second PDF page detailing the tracked hours linked to the invoice. */
function WorkLogPage({ data }: { data: InvoicePdfData }) {
  const totalHours = data.workLogs.reduce((sum, log) => sum + log.hours, 0)
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <View style={styles.brandRow}>
            <BrandMark />
            <Text style={styles.brandName}>doscientos</Text>
          </View>
          <Text style={styles.pageTitle}>Detalle de horas</Text>
          <Text style={styles.pageSubtitle}>Factura {data.fullNumber}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.thead}>
          <Text style={[styles.th, styles.wlDate]}>Fecha</Text>
          <Text style={[styles.th, styles.wlMember]}>Miembro</Text>
          <Text style={[styles.th, styles.wlRange]}>Horario</Text>
          <Text style={[styles.th, styles.wlHours]}>Horas</Text>
          <Text style={[styles.th, styles.wlNote]}>Nota</Text>
        </View>
        {data.workLogs.map((log, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: PDF is generated once from a fixed snapshot
          <View key={i} style={styles.row} wrap={false}>
            <Text style={styles.wlDate}>{log.workDate ? formatDate(log.workDate) : '—'}</Text>
            <Text style={styles.wlMember}>{log.memberName ?? '—'}</Text>
            <Text style={styles.wlRange}>
              {log.startTime && log.endTime ? `${log.startTime}–${log.endTime}` : '—'}
            </Text>
            <Text style={[styles.wlHours, { fontFamily: 'Helvetica-Bold' }]}>
              {formatWorkLogHours(log.hours)}
            </Text>
            <Text style={[styles.wlNote, { color: MUTED }]}>{log.note ?? ''}</Text>
          </View>
        ))}
      </View>

      <View style={styles.totals}>
        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>Total horas</Text>
          <Text style={styles.grandLabel}>{formatWorkLogHours(totalHours)}</Text>
        </View>
      </View>

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>
          Desglose de horas registradas asociadas a esta factura. Documento informativo, sin valor
          fiscal.
        </Text>
      </View>
    </Page>
  )
}

/** Render an invoice snapshot to a PDF buffer suitable for a download response. */
export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoicePdfDocument data={data} />)
}
