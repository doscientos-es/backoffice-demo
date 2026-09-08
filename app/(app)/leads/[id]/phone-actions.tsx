"use client";

import { MessageCircle, QrCode } from "lucide-react";
import Image from "next/image";
import { toDataURL } from "qrcode";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button as PopoverButton, PopoverContent, PopoverTrigger } from "@doscientos/ui";
import { publicEnv } from "@/lib/env";
import { buildBookingUrl } from "@/lib/recovery/utils";
import { cn } from "@/lib/utils";

import { startLeadCall } from "../actions";
import { WhatsAppComposer } from "../whatsapp-composer";

/**
 * Normalises a raw phone string into a clean `tel:` URI value.
 *
 * Rules (in order):
 * 1. Strip everything except digits and `+`.
 * 2. If `+` appears in the middle (e.g. `835+34…`), discard the prefix and
 *    keep from the `+` onwards — this handles operator/country-code prefixes
 *    that leads sometimes include when self-entering their number.
 * 3. Otherwise return the cleaned string as-is.
 */
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  const plusIndex = cleaned.indexOf("+");
  if (plusIndex > 0) return cleaned.slice(plusIndex);
  return cleaned;
}

/**
 * Renders a phone number as a clickable `tel:` link plus quick actions to
 * "send" the call to a mobile device from a desktop session:
 * - Copy the number to the clipboard (paste it into the phone).
 * - Scan a QR code with the phone's camera, which opens the dialer with the
 *   number preloaded.
 */
export function LeadCallLink({
  leadId,
  phone,
  children,
  className,
  ...props
}: {
  leadId: string;
  phone: string;
  children: React.ReactNode;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const normalized = normalizePhone(phone);
  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await startLeadCall({ leadId });
    } finally {
      window.location.href = `tel:${normalized}`;
    }
  }

  return (
    <a {...props} href={`tel:${normalized}`} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

export function PhoneQuickActions({
  phone,
  leadId,
  leadName,
  leadEmail,
  firstContactedAt,
  senderName,
  aiEnabled,
}: {
  phone: string;
  leadId?: string;
  leadName?: string;
  leadEmail?: string | null;
  firstContactedAt?: string | null;
  senderName: string;
  aiEnabled?: boolean;
}) {
  const normalized = normalizePhone(phone);
  return (
    <div className="flex items-center gap-1.5">
      {leadId ? (
        <LeadCallLink
          leadId={leadId}
          phone={phone}
          className="text-primary truncate underline-offset-2 hover:underline"
        >
          {phone}
        </LeadCallLink>
      ) : (
        <a
          href={`tel:${normalized}`}
          className="text-primary truncate underline-offset-2 hover:underline"
        >
          {phone}
        </a>
      )}
      <CopyButton text={normalized} successMessage="Teléfono copiado" label="Copiar teléfono" />
      <PhoneQrPopover phone={phone} />
      {leadId && leadName && (
        <LeadWhatsAppButton
          leadId={leadId}
          leadName={leadName}
          leadEmail={leadEmail ?? null}
          phone={phone}
          firstContactedAt={firstContactedAt}
          senderName={senderName}
          aiEnabled={aiEnabled}
        />
      )}
    </div>
  );
}

export function LeadWhatsAppButton({
  leadId,
  leadName,
  leadEmail,
  phone,
  firstContactedAt,
  senderName,
  aiEnabled,
}: {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  phone: string;
  firstContactedAt?: string | null;
  senderName: string;
  aiEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const bookingUrl = buildBookingUrl(publicEnv.NEXT_PUBLIC_CAL_LINK, {
    id: leadId,
    name: leadName,
    email: leadEmail,
  });
  const firstName = leadName.split(" ")[0] || leadName;
  const initialMessage = [
    `Hola, ${firstName}. Soy ${senderName || "el equipo"}, de Doscientos.`,
    "He intentado llamarte porque rellenaste un formulario en uno de nuestros anuncios de Meta.",
    "Me gustaría entender qué necesitas y ver si podemos ayudarte.",
    bookingUrl
      ? `Puedes contarme brevemente por aquí o, si lo prefieres, agendar una reunión: ${bookingUrl}`
      : "Puedes contarme brevemente por aquí y te respondo en cuanto pueda.",
    "¿Qué te resulta más cómodo?",
  ].join("\n\n");
  const message = firstContactedAt
    ? `Hola, ${firstName}. Soy ${senderName || "el equipo"}, de Doscientos.`
    : initialMessage;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Preparar WhatsApp"
          title="Preparar WhatsApp"
          className="size-6 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/10"
        >
          <MessageCircle className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Preparar WhatsApp</DialogTitle>
          <DialogDescription>
            Envía el mensaje en WhatsApp y confírmalo después para registrarlo.
          </DialogDescription>
        </DialogHeader>
        <WhatsAppComposer
          leadId={leadId}
          leadName={leadName}
          leadEmail={leadEmail}
          leadPhone={phone}
          senderName={senderName}
          aiEnabled={aiEnabled}
          defaultMessage={message}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PhoneQrPopover({ phone }: { phone: string }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  // Regenerate QR every time the popover opens or the phone changes.
  // `qr` is intentionally excluded from deps to avoid an infinite loop.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setQr(null);
    toDataURL(`tel:${normalizePhone(phone)}`, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phone]);

  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      <PopoverButton
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label="Mostrar QR para llamar desde el móvil"
        className={cn("text-muted-foreground hover:bg-muted hover:text-foreground")}
      >
        <QrCode className="size-3.5" />
      </PopoverButton>
      <PopoverContent className="flex w-auto flex-col items-center gap-2 p-3">
        <p className="text-muted-foreground text-center text-xs">
          Escanea con el móvil para llamar a
          <br />
          <span className="text-foreground font-medium">{normalizePhone(phone)}</span>
        </p>
        <div className="bg-muted flex size-[220px] items-center justify-center rounded-md">
          {qr ? (
            <Image
              src={qr}
              alt={`QR para llamar a ${phone}`}
              width={220}
              height={220}
              unoptimized
            />
          ) : (
            <span className="text-muted-foreground text-xs">Generando…</span>
          )}
        </div>
      </PopoverContent>
    </PopoverTrigger>
  );
}
