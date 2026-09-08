import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  Document,
  Font,
  Image,
  Link,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

const BRAND = '#2A4227'
const INK = '#1A2E18'
const ACCENT = '#BDFF7B'
const PAPER = '#FAFAF7'
const MIST = '#E9F1E6'
const MUTED = '#657067'
const CTA_URL = 'https://doscientos.es/diagnostico#formulario'
const BOOKING_URL = 'https://cal.eu/doscientos/30min'

// React PDF hyphenates by default. In a sales document, a broken word is worse
// than a slightly earlier line break, so titles and buttons keep whole words.
Font.registerHyphenationCallback((word) => [word])

function asset(file: string): string {
  const extension = path.extname(file).slice(1)
  const mime = extension === 'png' ? 'image/png' : `image/${extension}`
  return `data:${mime};base64,${readFileSync(path.join(process.cwd(), 'public', file)).toString('base64')}`
}

const assets = {
  logo: asset('brand/logo.png'),
  flatmatch: asset('diagnostics/flatmatch.png'),
  ifco: asset('diagnostics/ifco.png'),
  arenas: asset('diagnostics/arenas.png'),
}

const styles = StyleSheet.create({
  page: { backgroundColor: PAPER, color: INK, fontFamily: 'Helvetica', fontSize: 10, padding: 42 },
  cover: { backgroundColor: BRAND, color: '#FFFFFF', fontFamily: 'Helvetica', padding: 42 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerBrand: { alignItems: 'center', flexDirection: 'row' },
  logo: { height: 24, width: 24 },
  logoTile: { backgroundColor: '#FFFFFF', borderRadius: 8, height: 34, padding: 6, width: 34 },
  brand: { color: BRAND, fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 1 },
  brandLight: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 1 },
  pageLabel: { color: MUTED, fontSize: 8 },
  coverTag: {
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 0.8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  coverHero: { marginTop: 90 },
  eyebrow: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1.25,
    textTransform: 'uppercase',
  },
  eyebrowLight: {
    color: ACCENT,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1.25,
    textTransform: 'uppercase',
  },
  title: {
    color: INK,
    fontFamily: 'Helvetica-Bold',
    fontSize: 26,
    lineHeight: 1.06,
    marginTop: 11,
    maxWidth: 445,
  },
  coverTitle: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 36,
    lineHeight: 1.07,
    marginTop: 14,
    maxWidth: 410,
  },
  intro: { color: MUTED, fontSize: 11, lineHeight: 1.5, marginTop: 12, maxWidth: 435 },
  coverIntro: { color: '#DDE9DB', fontSize: 12, lineHeight: 1.5, marginTop: 16, maxWidth: 390 },
  section: { marginTop: 28 },
  body: { color: MUTED, fontSize: 10, lineHeight: 1.5 },
  metrics: { flexDirection: 'row', marginTop: 20 },
  metric: { backgroundColor: MIST, borderRadius: 12, flex: 1, minHeight: 102, padding: 14 },
  metricMiddle: { marginHorizontal: 8 },
  metricLabel: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: INK,
    fontFamily: 'Helvetica-Bold',
    fontSize: 21,
    lineHeight: 1,
    marginTop: 9,
  },
  metricText: { color: MUTED, fontSize: 8, lineHeight: 1.35, marginTop: 7 },
  coverMetric: { backgroundColor: '#355332', borderRadius: 14, marginTop: 42, padding: 19 },
  coverMetricValue: { color: ACCENT, fontFamily: 'Helvetica-Bold', fontSize: 29, marginTop: 6 },
  coverMetricText: { color: '#DDE9DB', fontSize: 9, lineHeight: 1.4, marginTop: 6 },
  panel: { backgroundColor: BRAND, borderRadius: 14, marginTop: 20, padding: 18 },
  panelTitle: {
    color: ACCENT,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  panelText: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    lineHeight: 1.35,
    marginTop: 8,
  },
  panelBody: { color: '#DDE9DB', fontSize: 9, lineHeight: 1.45, marginTop: 8 },
  callout: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E1D7',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
  },
  calloutText: {
    color: INK,
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    lineHeight: 1.35,
    marginTop: 7,
  },
  rows: { marginTop: 15 },
  row: {
    borderBottomColor: '#D9E1D7',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingVertical: 8,
  },
  rowLabel: { color: BRAND, fontFamily: 'Helvetica-Bold', fontSize: 8, width: '42%' },
  rowValue: { color: INK, fontSize: 8.5, lineHeight: 1.35, width: '58%' },
  columns: { flexDirection: 'row', marginTop: 20 },
  column: { flex: 1 },
  columnMiddle: {
    borderColor: '#D9E1D7',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    marginHorizontal: 12,
    paddingHorizontal: 12,
  },
  columnNumber: { color: '#7B9975', fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 1 },
  columnTitle: {
    color: INK,
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    lineHeight: 1.25,
    marginTop: 8,
  },
  columnText: { color: MUTED, fontSize: 8.5, lineHeight: 1.45, marginTop: 6 },
  comparison: { flexDirection: 'row', marginTop: 20 },
  comparisonSide: { flex: 1, minHeight: 245, padding: 17 },
  comparisonOld: {
    backgroundColor: '#EDF0EC',
    borderBottomLeftRadius: 14,
    borderTopLeftRadius: 14,
  },
  comparisonNew: { backgroundColor: BRAND, borderBottomRightRadius: 14, borderTopRightRadius: 14 },
  comparisonTitle: {
    color: INK,
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
    lineHeight: 1.25,
    marginTop: 10,
  },
  comparisonTitleLight: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
    lineHeight: 1.25,
    marginTop: 10,
  },
  comparisonText: { color: MUTED, fontSize: 8.5, lineHeight: 1.45, marginTop: 12 },
  comparisonTextLight: { color: '#DDE9DB', fontSize: 8.5, lineHeight: 1.45, marginTop: 12 },
  project: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E1D7',
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 13,
    overflow: 'hidden',
  },
  projectImage: { height: 124, objectFit: 'cover', width: 155 },
  projectContent: { flex: 1, padding: 13 },
  projectTag: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    letterSpacing: 0.85,
    textTransform: 'uppercase',
  },
  projectTitle: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 13, marginTop: 5 },
  projectText: { color: MUTED, fontSize: 8.5, lineHeight: 1.4, marginTop: 5 },
  projectResult: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    lineHeight: 1.35,
    marginTop: 7,
  },
  final: { backgroundColor: BRAND, borderRadius: 18, marginTop: 32, padding: 27 },
  finalTitle: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 24,
    lineHeight: 1.08,
    maxWidth: 400,
  },
  finalText: { color: '#DDE9DB', fontSize: 11, lineHeight: 1.5, marginTop: 13, maxWidth: 400 },
  cta: {
    backgroundColor: ACCENT,
    borderRadius: 9,
    marginTop: 23,
    paddingHorizontal: 16,
    paddingVertical: 12,
    textDecoration: 'none',
    width: 250,
  },
  ctaText: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 10, textAlign: 'center' },
  secondaryLink: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    marginTop: 15,
    textDecoration: 'underline',
  },
  footer: { bottom: 24, color: MUTED, fontSize: 7.5, left: 42, position: 'absolute', right: 42 },
  footerLine: { borderTopColor: '#D9E1D7', borderTopWidth: 1, paddingTop: 8 },
})

export type DiagnosticPdfData = {
  name: string
  company: string | null
  reportUrl?: string
  answers: Record<string, unknown>
  metrics: {
    yearlyHours: number
    yearlyCost: number
    monthlyHours: number
    risk: string
    primaryOpportunity: string
  }
}

const labels: Record<string, string> = {
  proceso: 'Proceso que quieres mejorar',
  personas: 'Personas implicadas',
  minutos_por_vez: 'Tiempo por repetición',
  veces_por_semana: 'Repeticiones por semana',
  coste_hora: 'Coste estimado por hora',
  impacto: 'Consecuencia principal',
}
function printable(value: unknown): string {
  return Array.isArray(value)
    ? value.map(printable).join(', ')
    : typeof value === 'object' && value !== null
      ? 'Información aportada en el diagnóstico'
      : String(value)
}

function excerpt(value: string, limit = 88): string {
  if (value.length <= limit) return value
  const lastSpace = value.lastIndexOf(' ', limit - 1)
  return `${value.slice(0, lastSpace > 0 ? lastSpace : limit)}…`
}
function Header({ page }: { page: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerBrand}>
        <Image src={assets.logo} style={styles.logo} />
        <Text style={[styles.brand, { marginLeft: 7 }]}>doscientos</Text>
      </View>
      <Text style={styles.pageLabel}>{page}</Text>
    </View>
  )
}
function Footer({
  children = 'doscientos · sistemas a medida para operaciones que importan',
}: {
  children?: string
}) {
  return (
    <View fixed style={styles.footer}>
      <Text style={styles.footerLine}>{children}</Text>
    </View>
  )
}
function Metric({
  label,
  value,
  text,
  middle = false,
}: {
  label: string
  value: string
  text: string
  middle?: boolean
}) {
  return (
    <View style={[styles.metric, middle ? styles.metricMiddle : {}]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricText}>{text}</Text>
    </View>
  )
}
function Project({
  image,
  tag,
  title,
  text,
  result,
}: {
  image: string
  tag: string
  title: string
  text: string
  result: string
}) {
  return (
    <View style={styles.project}>
      <Image src={image} style={styles.projectImage} />
      <View style={styles.projectContent}>
        <Text style={styles.projectTag}>{tag}</Text>
        <Text style={styles.projectTitle}>{title}</Text>
        <Text style={styles.projectText}>{text}</Text>
        <Text style={styles.projectResult}>{result}</Text>
      </View>
    </View>
  )
}

function DiagnosticDocument({ data }: { data: DiagnosticPdfData }) {
  const euro = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
  const company = data.company || data.name
  const process = printable(data.answers.proceso || data.metrics.primaryOpportunity)
  const impact = printable(data.answers.impact || 'Evitar trabajo repetitivo y errores')
  const companyForTitle = company.length > 24 ? 'tu empresa' : company
  const primaryActionUrl = data.reportUrl ?? CTA_URL
  const primaryActionLabel = data.reportUrl
    ? 'Ver mi diagnóstico online →'
    : 'Solicitar revisión del proceso →'
  const answers = Object.entries(data.answers)
    .filter(([, item]) => item != null && printable(item).trim())
    .slice(0, 6)
  return (
    <Document
      title={`Diagnóstico operativo · ${company}`}
      author="doscientos"
      subject="Diagnóstico personalizado y propuesta de mejora"
    >
      <Page size="A4" style={styles.cover}>
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <View style={styles.logoTile}>
              <Image src={assets.logo} style={styles.logo} />
            </View>
            <Text style={[styles.brandLight, { marginLeft: 9 }]}>doscientos</Text>
          </View>
          <Text style={styles.coverTag}>Análisis de proceso</Text>
        </View>
        <View style={styles.coverHero}>
          <Text style={styles.eyebrowLight}>Diagnóstico operativo · {company}</Text>
          <Text style={styles.coverTitle}>
            El tiempo de tu equipo debería estar mejor empleado.
          </Text>
          <Text style={styles.coverIntro}>
            Hemos convertido tus respuestas en un punto de partida claro: qué proceso mirar primero,
            qué puede cambiar y cómo abordarlo sin complicar más tu operación.
          </Text>
          <View style={styles.coverMetric}>
            <Text style={styles.eyebrowLight}>Tiempo recuperable estimado</Text>
            <Text style={styles.coverMetricValue}>{data.metrics.yearlyHours} h / año</Text>
            <Text style={styles.coverMetricText}>
              {data.metrics.monthlyHours} horas al mes que hoy se van en un proceso que puede
              funcionar mejor.
            </Text>
          </View>
        </View>
        <Text
          style={[
            styles.coverMetricText,
            { bottom: 42, left: 42, position: 'absolute', right: 42 },
          ]}
        >
          Una guía práctica para convertir fricción operativa en un sistema que acompaña al equipo.
        </Text>
      </Page>
      <Page size="A4" style={styles.page}>
        <Header page="01 / Tu oportunidad" />
        <View style={styles.section}>
          <Text style={styles.eyebrow}>La lectura de tu caso</Text>
          <Text style={styles.title}>{'Hay una mejora concreta\nsobre la mesa.'}</Text>
          <Text style={styles.intro}>
            En {company}, el proceso de “{process}” ya merece una revisión: cada repetición consume
            atención que el equipo podría dedicar a trabajo de más valor.
          </Text>
        </View>
        <View style={styles.metrics}>
          <Metric
            label="Tiempo anual"
            value={`${data.metrics.yearlyHours} h`}
            text="Esfuerzo estimado dedicado hoy."
          />
          <Metric
            middle
            label="Coste orientativo"
            value={euro.format(data.metrics.yearlyCost)}
            text="Sin contar retrasos ni oportunidades perdidas."
          />
          <Metric label="Prioridad" value={data.metrics.risk} text="Según el volumen indicado." />
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Por dónde empezaríamos</Text>
          <Text style={styles.panelText}>{data.metrics.primaryOpportunity}</Text>
          <Text style={styles.panelBody}>
            Primero entendemos el flujo real. Después diseñamos el mínimo sistema útil para liberar
            tiempo, sin añadir pasos innecesarios.
          </Text>
        </View>
        <View style={styles.callout}>
          <Text style={styles.eyebrow}>La señal detrás del dato</Text>
          <Text style={styles.calloutText}>El impacto que indicaste: {impact}.</Text>
          <Text style={styles.body}>
            Cuando la información vive repartida o depende de que alguien se acuerde, el coste no es
            solo tiempo: el proceso deja de ser predecible.
          </Text>
        </View>
        <Footer>
          Estimación orientativa: sirve para decidir dónde investigar primero, no para sustituir una
          auditoría de proceso.
        </Footer>
      </Page>
      <Page size="A4" style={styles.page}>
        <Header page="02 / El punto de partida" />
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Tu contexto, sin tecnicismos</Text>
          <Text style={styles.title}>{'Esto es lo que\nnos has contado.'}</Text>
          <Text style={styles.intro}>
            No partimos de una plantilla. Partimos de cómo trabaja tu equipo ahora para decidir qué
            merece la pena simplificar, conectar o automatizar.
          </Text>
        </View>
        <View style={styles.rows}>
          {answers.map(([key, item]) => (
            <View key={key} style={styles.row}>
              <Text style={styles.rowLabel}>{labels[key] || key.replaceAll('_', ' ')}</Text>
              <Text style={styles.rowValue}>{printable(item)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.metrics}>
          <Metric
            label="Personas implicadas"
            value={printable(data.answers.personas || 'Tu equipo')}
            text="El sistema debe ayudar a todas, no solo a quien lo administra."
          />
          <Metric
            middle
            label="Ritmo actual"
            value={printable(data.answers.veces_por_semana || 'Por definir')}
            text="La frecuencia muestra dónde una mejora tiene efecto acumulado."
          />
          <Metric
            label="Ahorro mensual"
            value={`${data.metrics.monthlyHours} h`}
            text="Una referencia para imaginar el cambio diario."
          />
        </View>
        <View style={styles.callout}>
          <Text style={styles.eyebrow}>Cómo lo convertiríamos en un plan</Text>
          <Text style={styles.calloutText}>
            Mapear → recortar pasos → diseñar un primer módulo útil.
          </Text>
          <Text style={styles.body}>
            La meta no es reemplazar todo de golpe. Es resolver una fricción prioritaria, validar
            que el equipo la adopta y seguir desde ahí con información real.
          </Text>
        </View>
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Header page="03 / Qué es doscientos" />
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Sistemas que encajan</Text>
          <Text style={styles.title}>{'Una solución útil para\nun trabajo concreto.'}</Text>
          <Text style={styles.intro}>
            doscientos diseña y desarrolla software a medida para empresas que han superado las
            hojas de cálculo, las herramientas desconectadas y los parches de cada día.
          </Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelText}>
            No vendemos una app genérica. Diseñamos un sistema que se parece a la forma en la que de
            verdad trabajas.
          </Text>
          <Text style={styles.panelBody}>
            Un CRM que recuerda lo importante, una operativa que conecta ventas e inventario o una
            modernización que no frena el negocio: la tecnología debe hacer el trabajo más claro, no
            más técnico.
          </Text>
        </View>
        <View style={styles.columns}>
          {[
            [
              '01 · ENTENDER',
              'La realidad antes que la solución.',
              'Hablamos con las personas que ejecutan el proceso y detectamos lo que de verdad se repite.',
            ],
            [
              '02 · DISEÑAR',
              'Una herramienta que se entiende al abrirla.',
              'Convertimos el flujo en pantallas, automatizaciones e integraciones que tienen sentido.',
            ],
            [
              '03 · ENTREGAR',
              'Valor útil desde el primer módulo.',
              'Avanzamos en fases cortas, validando con negocio antes de hacer crecer el sistema.',
            ],
          ].map(([number, title, text], index) => (
            <View key={number} style={[styles.column, index === 1 ? styles.columnMiddle : {}]}>
              <Text style={styles.columnNumber}>{number}</Text>
              <Text style={styles.columnTitle}>{title}</Text>
              <Text style={styles.columnText}>{text}</Text>
            </View>
          ))}
        </View>
        <View style={styles.callout}>
          <Text style={styles.eyebrow}>La medida del éxito</Text>
          <Text style={styles.calloutText}>
            No es “más software”. Es que cada persona sepa qué hacer, qué falta y qué se ha
            decidido.
          </Text>
        </View>
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Header page="04 / Por qué a medida" />
        <View style={styles.section}>
          <Text style={styles.eyebrow}>La diferencia práctica</Text>
          <Text style={styles.title}>{'Tu proceso no debería\nvivir entre parches.'}</Text>
          <Text style={styles.intro}>
            Las herramientas estándar son útiles hasta que obligan al equipo a cambiar su forma de
            trabajar. Ahí empieza el trabajo duplicado y la falta de contexto.
          </Text>
        </View>
        <View style={styles.comparison}>
          <View style={[styles.comparisonSide, styles.comparisonOld]}>
            <Text style={styles.eyebrow}>Cuando todo está repartido</Text>
            <Text style={styles.comparisonTitle}>
              La operación depende de recordar, copiar y preguntar.
            </Text>
            <Text style={styles.comparisonText}>
              • Datos en hojas, emails y varias herramientas.
            </Text>
            <Text style={styles.comparisonText}>• Seguimientos manuales que se retrasan.</Text>
            <Text style={styles.comparisonText}>• Procesos distintos según quién los hace.</Text>
          </View>
          <View style={[styles.comparisonSide, styles.comparisonNew]}>
            <Text style={styles.eyebrowLight}>Con un sistema pensado para vosotros</Text>
            <Text style={styles.comparisonTitleLight}>
              El proceso guía, avisa y deja trazabilidad.
            </Text>
            <Text style={styles.comparisonTextLight}>
              • Una fuente de información clara para el equipo.
            </Text>
            <Text style={styles.comparisonTextLight}>
              • Avisos y tareas que aparecen cuando tocan.
            </Text>
            <Text style={styles.comparisonTextLight}>• Decisiones con contexto, no a ciegas.</Text>
          </View>
        </View>
        <View style={styles.callout}>
          <Text style={styles.eyebrow}>Lo que ganas</Text>
          <Text style={styles.calloutText}>
            Conectamos lo que ya funciona, quitamos los cuellos de botella y dejamos un sistema que
            puede crecer a vuestro ritmo.
          </Text>
          <Text style={styles.body}>
            No se trata de que el equipo aprenda “informática”: la interfaz habla el idioma del
            trabajo.
          </Text>
        </View>
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Header page="05 / Proyectos reales" />
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Referencias que hablan de trabajo</Text>
          <Text style={styles.title}>{'Proyectos distintos.\nTrabajo útil.'}</Text>
          <Text style={styles.intro}>
            No hay dos operaciones iguales. Por eso cada proyecto empieza por una necesidad concreta
            y termina en una herramienta que el equipo puede usar desde el primer día.
          </Text>
        </View>
        <Project
          image={assets.flatmatch}
          tag="Producto digital · Proptech"
          title="Flatmatch"
          text="Diseñamos y desarrollamos una plataforma de alojamiento temporal con experiencia swipe para que estudiantes y jóvenes profesionales encuentren piso sin fatiga de decisión."
          result="Resultado: 500+ usuarios en tres meses y un 70% menos de tiempo de búsqueda."
        />
        <Project
          image={assets.ifco}
          tag="Modernización crítica · Logística"
          title="IFCO Systems"
          text="Migramos un sistema de trazabilidad de palés desde una plataforma legacy sin detener una operación que funciona en múltiples países."
          result="Resultado: cero interrupciones y una respuesta un 60% más rápida."
        />
        <Project
          image={assets.arenas}
          tag="Datos + experiencia web · Cultura"
          title="Explorador del Fondo Areñas"
          text="Convertimos un archivo histórico en un explorador visual de conocimiento que conecta fotografías, personas, lugares y contextos."
          result="Resultado: 564 fotografías conectadas en una experiencia de descubrimiento."
        />
        <Footer>Imágenes y casos: proyectos desarrollados por doscientos.</Footer>
      </Page>
      <Page size="A4" style={styles.page}>
        <Header page="06 / Siguiente paso" />
        <View style={styles.final}>
          <Text style={styles.eyebrowLight}>Llevémoslo a la práctica</Text>
          <Text
            style={styles.finalTitle}
          >{`Veamos qué merece la pena\ncambiar en ${companyForTitle}.`}</Text>
          <Text style={styles.finalText}>
            El siguiente paso no es comprar software. Es contrastar este diagnóstico con el proceso
            real y dibujar el primer cambio que tendría impacto.
          </Text>
          <Text style={[styles.panelText, { color: ACCENT, marginTop: 20 }]}>
            Primer foco: {excerpt(process)}. Hoy está generando {impact.toLowerCase()}.
          </Text>
          <Link src={primaryActionUrl} style={styles.cta}>
            <Text style={styles.ctaText}>{primaryActionLabel}</Text>
          </Link>
          <Link src={BOOKING_URL} style={styles.secondaryLink}>
            <Text>Reservar 30 minutos</Text>
          </Link>
        </View>
        <View style={styles.columns}>
          {[
            ['01', 'Nos cuentas el flujo real, con ejemplos.'],
            ['02', 'Priorizamos una mejora que se pueda medir.'],
            ['03', 'Te devolvemos una propuesta clara, sin humo.'],
          ].map(([number, text], index) => (
            <View key={number} style={[styles.column, index === 1 ? styles.columnMiddle : {}]}>
              <Text style={styles.columnNumber}>{number}</Text>
              <Text style={styles.columnTitle}>{text}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.body, { fontSize: 7.5, marginTop: 25 }]}>
          Este recurso es una estimación inicial basada en los datos facilitados. Su objetivo es
          ayudarte a iniciar una conversación útil sobre una mejora concreta, no prometer un
          resultado antes de entender la operación.
        </Text>
        <Footer>doscientos · hola@doscientos.es · doscientos.es</Footer>
      </Page>
    </Document>
  )
}

export async function renderDiagnosticPdf(data: DiagnosticPdfData): Promise<Buffer> {
  return renderToBuffer(<DiagnosticDocument data={data} />)
}
