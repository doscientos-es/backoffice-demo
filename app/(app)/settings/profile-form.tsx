'use client'

import {
  CircleAlert as AlertCircle,
  CircleCheck as CheckCircle2,
  LoaderCircle as Loader2,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { buildSignatureHtml } from '@/lib/email/signature'
import { useGithubHandle } from '@/lib/hooks/use-github-handle'
import { cn } from '@/lib/utils'

import { updateProfile } from './actions'

interface Props {
  name: string
  email: string
  avatarUrl: string | null
  emailAlias: string | null
  githubHandle: string | null
  jobTitle: string | null
  phone: string | null
  contactEmail: string | null
}

export function ProfileForm({
  name,
  email,
  avatarUrl,
  emailAlias,
  githubHandle,
  jobTitle,
  phone,
  contactEmail,
}: Props) {
  const feedback = useFormFeedback()
  const [previewFields, setPreviewFields] = useState({
    jobTitle: jobTitle ?? '',
    contactEmail: contactEmail ?? '',
    phone: phone ?? '',
  })
  const [handle, setHandle] = useState(githubHandle ?? '')
  const handleState = useGithubHandle(handle)

  const initials = useMemo(() => {
    const source = name.trim() || email
    return source
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [name, email])

  // Priority: Google avatar (synced on login) → GitHub avatar from handle → null
  const avatarSrc = useMemo(() => {
    if (avatarUrl) return avatarUrl
    const trimmed = handle.trim()
    // Synchronous regex check for immediate preview
    if (/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(trimmed)) {
      return `https://github.com/${trimmed}.png?size=200`
    }
    return handleState.avatarUrl ?? undefined
  }, [avatarUrl, handle, handleState.avatarUrl])

  const signaturePreview = buildSignatureHtml({
    name,
    jobTitle: previewFields.jobTitle,
    contactEmail: previewFields.contactEmail,
    phone: previewFields.phone,
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    feedback.setPending()
    const result = await updateProfile(fd)
    if (result.ok) feedback.setSuccess('Perfil guardado')
    else feedback.setError(result.error)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel className="text-muted-foreground text-xs font-medium">Nombre</FieldLabel>
          <Input value={name} disabled aria-readonly />
          <FieldDescription>Sincronizado con tu cuenta.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel className="text-muted-foreground text-xs font-medium">Email</FieldLabel>
          <Input value={email} disabled aria-readonly />
          <FieldDescription>No editable desde aquí.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="job_title" className="text-xs font-medium">
            Rol / Cargo
          </FieldLabel>
          <Input
            id="job_title"
            name="job_title"
            defaultValue={jobTitle ?? ''}
            placeholder="Co-founder & Software Engineer"
            maxLength={160}
            autoComplete="organization-title"
            onChange={(e) => setPreviewFields((p) => ({ ...p, jobTitle: e.target.value }))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact_email" className="text-xs font-medium">
            Email de contacto
          </FieldLabel>
          <Input
            id="contact_email"
            name="contact_email"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={contactEmail ?? ''}
            placeholder="pol@doscientos.es"
            onChange={(e) => setPreviewFields((p) => ({ ...p, contactEmail: e.target.value }))}
          />
          <FieldDescription>
            Aparece en la firma. Si se deja vacío, se usa el alias de envío.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="phone" className="text-xs font-medium">
            Teléfono
          </FieldLabel>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={phone ?? ''}
            placeholder="+34 600 000 000"
            maxLength={30}
            onChange={(e) => setPreviewFields((p) => ({ ...p, phone: e.target.value }))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email_alias" className="text-xs font-medium">
            Alias de envío
          </FieldLabel>
          <Input
            id="email_alias"
            name="email_alias"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={emailAlias ?? ''}
            placeholder="notificaciones@empresa.com"
          />
          <FieldDescription>
            Dirección desde la que se envían los emails a tus clientes.
          </FieldDescription>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="github_handle" className="text-xs font-medium">
          GitHub handle
        </FieldLabel>
        <div className="flex items-center gap-3">
          <Avatar size="default" className="shrink-0">
            {avatarSrc ? (
              <AvatarImage src={avatarSrc} alt={name} referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="relative flex-1">
            <Input
              id="github_handle"
              name="github_handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="tu-usuario"
              maxLength={39}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              aria-invalid={handleState.status === 'invalid' || handleState.status === 'not_found'}
              aria-describedby="github_handle_status"
              className="pr-9"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center"
            >
              <GithubHandleIcon status={handleState.status} />
            </span>
          </div>
        </div>
        <FieldDescription id="github_handle_status">
          <GithubHandleMessage state={handleState} />
        </FieldDescription>
      </Field>

      {/* Signature preview — auto-generated */}
      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs font-medium">Vista previa de la firma</p>
        {/* biome-ignore lint/a11y/useSemanticElements: <fieldset> introduciría estilos por defecto no deseados */}
        <div
          role="group"
          className="border-border text-foreground min-h-12 rounded-lg border border-dashed bg-white px-4 py-3 text-sm"
          aria-label="Vista previa de la firma"
        >
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: contenido generado internamente */}
          <div dangerouslySetInnerHTML={{ __html: signaturePreview }} />
        </div>
        <p className="text-muted-foreground/70 text-xs">
          La firma se genera automáticamente a partir de los campos anteriores.
        </p>
      </div>

      <div className="border-border flex items-center justify-end gap-3 border-t pt-4">
        <FormFeedback state={feedback.state} successLabel="Perfil guardado" />
        <SubmitButton pendingLabel="Guardando…" loading={feedback.pending}>
          Guardar perfil
        </SubmitButton>
      </div>
    </form>
  )
}

function GithubHandleIcon({ status }: { status: ReturnType<typeof useGithubHandle>['status'] }) {
  const iconClass = 'size-4'
  if (status === 'checking')
    return <Loader2 className={cn(iconClass, 'animate-spin text-muted-foreground')} aria-hidden />
  if (status === 'valid')
    return <CheckCircle2 className={cn(iconClass, 'text-success')} aria-hidden />
  if (status === 'not_found' || status === 'invalid')
    return <XCircle className={cn(iconClass, 'text-destructive')} aria-hidden />
  if (status === 'rate_limited' || status === 'error')
    return <AlertCircle className={cn(iconClass, 'text-muted-foreground')} aria-hidden />
  return null
}

function GithubHandleMessage({ state }: { state: ReturnType<typeof useGithubHandle> }) {
  switch (state.status) {
    case 'empty':
      return <>Se usa para sincronizar tareas con issues y PRs de GitHub.</>
    case 'checking':
      return <span className="text-muted-foreground">Comprobando en GitHub…</span>
    case 'valid':
      return (
        <span className="text-success">
          {state.displayName ? `Conectado a ${state.displayName}.` : 'Handle verificado.'}
        </span>
      )
    case 'invalid':
      return (
        <span className="text-destructive">
          Formato no válido. Solo letras, números y guiones (sin empezar/terminar en guión).
        </span>
      )
    case 'not_found':
      return <span className="text-destructive">Ese usuario no existe en GitHub.</span>
    case 'rate_limited':
      return (
        <span className="text-muted-foreground">
          Demasiadas comprobaciones. Inténtalo en unos minutos.
        </span>
      )
    case 'error':
      return <span className="text-muted-foreground">No se ha podido verificar ahora mismo.</span>
  }
}
