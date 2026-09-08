import {
  Document,
  Font,
  Link,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

import type { KeyPoint } from '@/lib/proposals/key-points'
import type { MaintenanceOffer } from '@/lib/proposals/maintenance'
import {
  PAYMENT_SCHEDULE_LABELS,
  type PaymentSchedule,
  paymentInitialPercentage,
  type ScopeModule,
  scopeModuleDurationText,
} from '@/lib/proposals/scope'

const BRAND = '#2A4227'
const INK = '#183017'
const ACCENT = '#BDFF7B'
const PAPER = '#FAFAF7'
const MIST = '#E9F1E6'
const MUTED = '#657067'

Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  cover: { backgroundColor: BRAND, color: '#FFFFFF', fontFamily: 'Helvetica', padding: 48 },
  page: {
    backgroundColor: PAPER,
    color: INK,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    paddingBottom: 60,
    paddingHorizontal: 48,
    paddingTop: 82,
  },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 1.2 },
  brandLight: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 1.2 },
  coverHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  coverTag: {
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 0.9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  coverHero: { marginTop: 104 },
  eyebrow: {
    color: ACCENT,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  coverTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 31,
    lineHeight: 1.08,
    marginTop: 13,
    maxWidth: 420,
  },
  coverRecipient: { color: '#DDE9DB', fontSize: 12, lineHeight: 1.45, marginTop: 16 },
  metricCard: { backgroundColor: '#355332', borderRadius: 16, marginTop: 50, padding: 21 },
  metricLabel: {
    color: '#DDE9DB',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  metricValue: { color: ACCENT, fontFamily: 'Helvetica-Bold', fontSize: 30, marginTop: 7 },
  metricText: { color: '#DDE9DB', fontSize: 9, lineHeight: 1.4, marginTop: 6 },
  coverFooter: {
    bottom: 45,
    color: '#DDE9DB',
    fontSize: 8,
    left: 48,
    position: 'absolute',
    right: 48,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 48,
    position: 'absolute',
    right: 48,
    top: 35,
  },
  pageLabel: { color: MUTED, fontSize: 8 },
  section: { marginTop: 24 },
  sectionLabel: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
  },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 18, lineHeight: 1.18, marginTop: 7 },
  body: { color: MUTED, fontSize: 9.5, lineHeight: 1.55, marginTop: 10 },
  point: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E1D7',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 9,
    padding: 12,
  },
  pointTitle: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 10 },
  pointText: { color: MUTED, fontSize: 8.5, lineHeight: 1.45, marginTop: 4 },
  maintenanceTable: {
    borderColor: '#D9E1D7',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 13,
    overflow: 'hidden',
  },
  maintenanceRow: {
    borderTopColor: '#E5EAE3',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  maintenancePlanName: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  maintenanceSelection: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  maintenanceSummary: { color: MUTED, fontSize: 8, lineHeight: 1.4, marginTop: 3 },
  maintenanceListLabel: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 0.5,
    marginTop: 7,
    textTransform: 'uppercase',
  },
  maintenanceList: { color: MUTED, fontSize: 7.5, lineHeight: 1.4, marginTop: 2 },
  maintenancePrice: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    textAlign: 'right',
  },
  maintenanceVat: { color: MUTED, fontSize: 7.5, marginTop: 2, textAlign: 'right' },
  investment: { backgroundColor: BRAND, borderRadius: 14, marginTop: 13, padding: 18 },
  investmentLabel: {
    color: ACCENT,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  investmentValue: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 23, marginTop: 6 },
  investmentText: { color: '#DDE9DB', fontSize: 8.5, marginTop: 5 },
  table: {
    borderColor: '#D9E1D7',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 13,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: MIST,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  tableHeaderText: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: {
    borderTopColor: '#E5EAE3',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  itemDescription: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  itemMeta: { color: MUTED, fontSize: 7.5, marginTop: 3 },
  amount: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 8.5, textAlign: 'right' },
  totalRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  totalLabel: { color: MUTED, fontSize: 9, marginRight: 12 },
  totalValue: { color: BRAND, fontFamily: 'Helvetica-Bold', fontSize: 18 },
  footer: { bottom: 25, color: MUTED, fontSize: 7.5, left: 48, position: 'absolute', right: 48 },
  footerLine: { borderTopColor: '#D9E1D7', borderTopWidth: 1, paddingTop: 8 },
  bullet: { color: MUTED, fontSize: 8.5, lineHeight: 1.45, marginTop: 3 },
  cta: { backgroundColor: BRAND, borderRadius: 10, marginTop: 20, padding: 15 },
  ctaText: { color: '#DDE9DB', fontSize: 8.5, lineHeight: 1.45 },
  ctaLink: { color: ACCENT, fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 7 },
})

export type ProposalPdfItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  subtotal: number
  billingCycle: string | null
}

export type ProposalPdfData = {
  number: string | null
  title: string
  recipientName: string
  validUntil: string | null
  context: string | null
  problems: KeyPoint[]
  solutions: KeyPoint[]
  scopeModules: ScopeModule[]
  deliverables: string | null
  acceptanceCriteria: string | null
  paymentSchedule: PaymentSchedule
  paymentTerms: string | null
  changeManagementTerms: string | null
  terms: string | null
  notes: string | null
  subtotal: number
  taxAmount: number
  total: number
  items: ProposalPdfItem[]
  maintenanceOffer: MaintenanceOffer
  maintenanceSelectedPlanId: string | null
  portalUrl: string
  companyName: string | null
  iban: string | null
}

function money(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)
}

function date(value: string | null): string | null {
  if (!value) return null
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date(value))
}

function cycleLabel(cycle: string | null): string {
  return { monthly: 'Mensual', quarterly: 'Trimestral', yearly: 'Anual' }[cycle ?? ''] ?? 'Único'
}

export function proposalPdfFilename(number: string | null, id: string): string {
  const reference = number?.trim().replace(/[^a-zA-Z0-9_-]+/g, '-') || id
  return `propuesta-${reference}.pdf`
}

export function printableMarkdown(value: string | null): string {
  return (value ?? '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function Footer() {
  return (
    <View fixed style={styles.footer}>
      <Text style={styles.footerLine}>doscientos · Propuesta confidencial</Text>
    </View>
  )
}

function PointList({ points }: { points: KeyPoint[] }) {
  return (
    <>
      {points.map((point) => (
        <View key={point.id} style={styles.point} wrap={false}>
          <Text style={styles.pointTitle}>{point.title}</Text>
          {point.description ? (
            <Text style={styles.pointText}>{printableMarkdown(point.description)}</Text>
          ) : null}
        </View>
      ))}
    </>
  )
}

function ScopeModuleList({ modules }: { modules: ScopeModule[] }) {
  return (
    <>
      {modules.map((module, index) => (
        <View key={module.id} style={styles.point} wrap={false}>
          <Text
            style={styles.pointTitle}
          >{`${String(index + 1).padStart(2, '0')} · ${module.title}`}</Text>
          {module.description ? <Text style={styles.pointText}>{module.description}</Text> : null}
          {scopeModuleDurationText(module) ? (
            <Text
              style={styles.pointText}
            >{`Plazo estimado: ${scopeModuleDurationText(module)}`}</Text>
          ) : null}
          {module.included.length > 0 ? (
            <Text style={[styles.pointText, { color: BRAND, fontFamily: 'Helvetica-Bold' }]}>
              Incluido
            </Text>
          ) : null}
          {module.included.map((item) => (
            <Text key={`included-${item}`} style={styles.bullet}>{`• ${item}`}</Text>
          ))}
          {module.excluded.length > 0 ? (
            <Text style={[styles.pointText, { fontFamily: 'Helvetica-Bold' }]}>No incluido</Text>
          ) : null}
          {module.excluded.map((item) => (
            <Text key={`excluded-${item}`} style={styles.bullet}>{`• ${item}`}</Text>
          ))}
          {module.notes ? <Text style={styles.pointText}>{`Notas: ${module.notes}`}</Text> : null}
        </View>
      ))}
    </>
  )
}

function MaintenancePlanList({
  offer,
  selectedPlanId,
}: {
  offer: MaintenanceOffer
  selectedPlanId: string | null
}) {
  return (
    <View style={styles.maintenanceTable}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { width: '74%' }]}>Cobertura</Text>
        <Text style={[styles.tableHeaderText, { textAlign: 'right', width: '26%' }]}>
          Cuota mensual
        </Text>
      </View>
      {offer.plans.map((plan) => {
        const selected = plan.id === selectedPlanId
        return (
          <View key={plan.id} style={styles.maintenanceRow} wrap={false}>
            <View style={{ width: '74%' }}>
              <Text style={styles.maintenancePlanName}>{plan.name}</Text>
              {selected ? <Text style={styles.maintenanceSelection}>Plan elegido</Text> : null}
              <Text style={styles.maintenanceSummary}>{plan.summary}</Text>
              <Text style={styles.maintenanceListLabel}>Incluye</Text>
              <Text style={styles.maintenanceList}>{plan.coverage.join(' · ')}</Text>
              {plan.exclusions.length > 0 ? (
                <>
                  <Text style={styles.maintenanceListLabel}>No incluye</Text>
                  <Text style={styles.maintenanceList}>{plan.exclusions.join(' · ')}</Text>
                </>
              ) : null}
            </View>
            <View style={{ width: '26%' }}>
              <Text style={styles.maintenancePrice}>{`${money(plan.monthly_price)} / mes`}</Text>
              <Text style={styles.maintenanceVat}>+ IVA</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

function ProposalPdfDocument({ data }: { data: ProposalPdfData }) {
  const validUntil = date(data.validUntil)
  const hasRecurring = data.items.some((item) => item.billingCycle && item.billingCycle !== 'none')
  const deliverables = data.deliverables?.trim()
  const acceptanceCriteria = data.acceptanceCriteria?.trim()
  const initialPaymentPercentage = paymentInitialPercentage(data.paymentSchedule)
  const hasConditions = Boolean(data.paymentTerms || data.changeManagementTerms || data.terms)
  return (
    <Document title={`Propuesta ${data.number ?? ''} · ${data.title}`} author="doscientos">
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverHeader}>
          <Text style={styles.brandLight}>doscientos</Text>
          <Text style={styles.coverTag}>Propuesta {data.number ?? 'personalizada'}</Text>
        </View>
        <View style={styles.coverHero}>
          <Text style={styles.eyebrow}>Una propuesta para avanzar</Text>
          <Text style={styles.coverTitle}>{data.title}</Text>
          <Text style={styles.coverRecipient}>Preparada para {data.recipientName}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Inversión inicial</Text>
          <Text style={styles.metricValue}>{money(data.total)}</Text>
          <Text style={styles.metricText}>
            {validUntil
              ? `Válida hasta el ${validUntil}.`
              : 'Propuesta personalizada de doscientos.'}
          </Text>
        </View>
        <Text style={styles.coverFooter}>Documento confidencial · doscientos.es</Text>
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <View fixed style={styles.header}>
          <Text style={styles.brand}>doscientos</Text>
          <Text style={styles.pageLabel}>Propuesta {data.number ?? 'personalizada'}</Text>
        </View>

        {data.context ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Contexto</Text>
            <Text style={styles.sectionTitle}>El punto de partida</Text>
            <Text style={styles.body}>{printableMarkdown(data.context)}</Text>
          </View>
        ) : null}

        {data.problems.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Retos detectados</Text>
            <Text style={styles.sectionTitle}>Lo que queremos resolver</Text>
            <PointList points={data.problems} />
          </View>
        ) : null}

        {data.solutions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Nuestra propuesta</Text>
            <Text style={styles.sectionTitle}>Cómo lo abordamos</Text>
            <PointList points={data.solutions} />
          </View>
        ) : null}

        {data.scopeModules.length > 0 ? (
          <View
            style={styles.section}
            break={Boolean(data.context || data.problems.length || data.solutions.length)}
          >
            <Text style={styles.sectionLabel}>Alcance del proyecto</Text>
            <Text style={styles.sectionTitle}>Qué incluye esta propuesta</Text>
            <ScopeModuleList modules={data.scopeModules} />
          </View>
        ) : null}

        {deliverables || acceptanceCriteria ? (
          <View style={styles.section} break={data.scopeModules.length > 0}>
            <Text style={styles.sectionLabel}>Entrega y validación</Text>
            {deliverables ? (
              <>
                <Text style={styles.pointTitle}>Entregables</Text>
                <Text style={styles.body}>{printableMarkdown(deliverables)}</Text>
              </>
            ) : null}
            {acceptanceCriteria ? (
              <>
                <Text style={[styles.pointTitle, { marginTop: 12 }]}>Criterios de aceptación</Text>
                <Text style={styles.body}>{printableMarkdown(acceptanceCriteria)}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View
          style={styles.section}
          break={Boolean(
            data.context ||
            data.problems.length ||
            data.solutions.length ||
            data.scopeModules.length ||
            deliverables ||
            acceptanceCriteria,
          )}
        >
          <Text style={styles.sectionLabel}>Propuesta económica</Text>
          <Text style={styles.sectionTitle}>Inversión y alcance</Text>
          <View style={styles.investment}>
            <Text style={styles.investmentLabel}>Inversión inicial</Text>
            <Text style={styles.investmentValue}>{money(data.total)}</Text>
            <Text style={styles.investmentText}>
              Incluye {money(data.subtotal)} de base imponible e IVA de {money(data.taxAmount)}.
            </Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: '70%' }]}>Concepto</Text>
              <Text style={[styles.tableHeaderText, { textAlign: 'right', width: '30%' }]}>
                Importe
              </Text>
            </View>
            {data.items.map((item) => (
              <View key={item.id} style={styles.row} wrap={false}>
                <View style={{ width: '70%' }}>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                  <Text
                    style={styles.itemMeta}
                  >{`${item.quantity} × ${money(item.unitPrice)} · IVA ${item.vatRate}% · ${cycleLabel(item.billingCycle)}`}</Text>
                </View>
                <Text style={[styles.amount, { width: '30%' }]}>{money(item.subtotal)}</Text>
              </View>
            ))}
          </View>
          {hasRecurring ? (
            <Text style={styles.body}>
              Las líneas recurrentes se muestran con su cadencia correspondiente y no forman parte
              de la inversión inicial.
            </Text>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total inicial, IVA incluido</Text>
            <Text style={styles.totalValue}>{money(data.total)}</Text>
          </View>
        </View>

        {hasConditions || data.iban ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{hasConditions ? 'Condiciones y pago' : 'Pago'}</Text>
            {data.paymentTerms ? (
              <>
                <Text style={styles.pointTitle}>Forma de pago</Text>
                <Text style={styles.pointText}>
                  {PAYMENT_SCHEDULE_LABELS[data.paymentSchedule]}
                </Text>
                <Text style={styles.body}>{printableMarkdown(data.paymentTerms)}</Text>
              </>
            ) : null}
            {data.changeManagementTerms ? (
              <>
                <Text style={[styles.pointTitle, { marginTop: 12 }]}>Cambios de alcance</Text>
                <Text style={styles.body}>{printableMarkdown(data.changeManagementTerms)}</Text>
              </>
            ) : null}
            {data.terms ? <Text style={styles.body}>{printableMarkdown(data.terms)}</Text> : null}
            {data.iban ? (
              <>
                <Text style={[styles.pointTitle, { marginTop: hasConditions ? 12 : 0 }]}>
                  Pago por transferencia
                </Text>
                <Text style={styles.pointText}>
                  También puede abonar el primer plazo antes de recibir la factura con estos datos.
                </Text>
                <Text style={styles.body}>
                  Beneficiario: {data.companyName ?? '—'}{`\n`}IBAN: {data.iban}
                  {`\n`}Concepto: Propuesta {data.number ?? data.title}
                  {initialPaymentPercentage !== null
                    ? `\nPrimer plazo (${initialPaymentPercentage}%): ${money((data.total * initialPaymentPercentage) / 100)}`
                    : ''}
                </Text>
              </>
            ) : null}
          </View>
        ) : null}
        {data.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notas</Text>
            <Text style={styles.body}>{printableMarkdown(data.notes)}</Text>
          </View>
        ) : null}
        {data.maintenanceOffer.enabled && data.maintenanceOffer.plans.length > 0 ? (
          <View style={styles.section} break>
            <Text style={styles.sectionLabel}>Mantenimiento</Text>
            <Text style={styles.sectionTitle}>{data.maintenanceOffer.heading}</Text>
            <Text style={styles.body}>{data.maintenanceOffer.intro}</Text>
            <MaintenancePlanList
              offer={data.maintenanceOffer}
              selectedPlanId={data.maintenanceSelectedPlanId}
            />
            <Text style={styles.body}>
              Selecciona desde la propuesta online la cobertura que mejor se ajuste al mantenimiento
              de tu sistema.
            </Text>
          </View>
        ) : null}
        <View style={styles.cta} wrap={false}>
          <Text style={styles.ctaText}>
            ¿Todo claro? Revisa la propuesta online y confírmala para que podamos empezar.
          </Text>
          <Link src={data.portalUrl} style={styles.ctaLink}>
            Revisar y aceptar la propuesta →
          </Link>
        </View>
        <Footer />
      </Page>
    </Document>
  )
}

export async function renderProposalPdf(data: ProposalPdfData): Promise<Buffer> {
  return renderToBuffer(<ProposalPdfDocument data={data} />)
}
