import { buildBookingUrl } from '@/lib/recovery/utils'

export type WhatsAppLead = { id: string; name: string; email: string | null }

export function buildLeadWhatsAppMessage(
  lead: WhatsAppLead,
  senderName: string,
  calendarLink: string | undefined,
): string {
  const bookingUrl = buildBookingUrl(calendarLink, lead)
  return [
    `Hola, ${lead.name.split(' ')[0] || lead.name}. Soy ${senderName || 'el equipo'}, de Doscientos.`,
    'He intentado llamarte porque rellenaste un formulario en uno de nuestros anuncios de Meta.',
    'Me gustaría entender qué necesitas y ver si podemos ayudarte.',
    bookingUrl
      ? `Puedes contarme brevemente por aquí o, si lo prefieres, agendar una reunión: ${bookingUrl}`
      : 'Puedes contarme brevemente por aquí y te respondo en cuanto pueda.',
    '¿Qué te resulta más cómodo?',
  ].join('\n\n')
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  const internationalPhone = digits.length === 9 ? `34${digits}` : digits
  return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`
}
