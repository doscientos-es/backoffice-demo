"use client";

import { LoaderCircle as Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  OtpInput,
} from "@doscientos/ui";
import { Field, FieldLabel } from "@/components/ui/field";
import { getBrowserClient } from "@/lib/supabase/browser";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  dismissible?: boolean;
  setupHref?: string;
};

export function MfaChallengeDialog({
  open,
  onOpenChange,
  onVerified,
  dismissible = true,
  setupHref,
}: Props) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setError(null);
    setLoading(true);
    void getBrowserClient()
      .auth.mfa.listFactors()
      .then(({ data, error: factorsError }) => {
        const factor = data?.totp.find((candidate) => candidate.status === "verified");
        setFactorId(factor?.id ?? null);
        if (factorsError || !factor) {
          setError("No hay una aplicación Authenticator configurada para esta cuenta.");
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) return;
    setError(null);
    setLoading(true);
    const { error: verifyError } = await getBrowserClient().auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    setLoading(false);
    if (verifyError) {
      setError("El código no es válido. Comprueba la hora de tu dispositivo e inténtalo de nuevo.");
      return;
    }
    onVerified();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (dismissible || nextOpen) && onOpenChange(nextOpen)}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton={dismissible}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary size-5" /> Confirmar acción
          </DialogTitle>
          <DialogDescription>
            Introduce el código de seis dígitos de Google Authenticator para continuar. No saldrás
            de esta página.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={verify} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="invoice-mfa-code">Código de verificación</FieldLabel>
            <OtpInput
              id="invoice-mfa-code"
              autoFocus
              value={code}
              onChange={setCode}
              disabled={loading || !factorId}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "invoice-mfa-code-error" : undefined}
              required
            />
          </Field>
          {error ? (
            <p id="invoice-mfa-code-error" role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          {error && setupHref ? (
            <a className="text-primary text-sm underline underline-offset-4" href={setupHref}>
              Configurar MFA en Seguridad
            </a>
          ) : null}
          <DialogFooter>
            {dismissible ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" disabled={loading || !factorId || code.length < 6}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null} Verificar y continuar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
