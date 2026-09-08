'use client'

import {
  CircleAlert as AlertCircle,
  CircleCheck as CheckCircle2,
  LoaderCircle as Loader2,
  Pencil,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { useGithubHandle } from '@/lib/hooks/use-github-handle'
import { cn } from '@/lib/utils'

import { updateMemberProfile } from '../actions'

export interface MemberProfileData {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  githubHandle: string | null
  jobTitle: string | null
  phone: string | null
  contactEmail: string | null
  emailAlias: string | null
}

export function MemberProfileDialog({ member }: { member: MemberProfileData }) {
  const [open, setOpen] = useState(false)
  const feedback = useFormFeedback()
  const [handle, setHandle] = useState(member.githubHandle ?? '')
  const handleState = useGithubHandle(handle)

  const initials = useMemo(() => {
    const source = member.name.trim() || member.email
    return source
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [member.name, member.email])

  const avatarSrc = useMemo(() => {
    if (member.avatarUrl) return member.avatarUrl
    const trimmed = handle.trim()
    if (/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(trimmed)) {
      return `https://github.com/${trimmed}.png?size=200`
    }
    return handleState.avatarUrl ?? undefined
  }, [member.avatarUrl, handle, handleState.avatarUrl])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    feedback.setPending()
    const result = await updateMemberProfile(fd)
    if (result.ok) {
      feedback.setSuccess('Perfil guardado')
      setTimeout(() => setOpen(false), 900)
    } else {
      feedback.setError(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-7 shrink-0"
        >
          <Pencil className="size-3.5" />
          <span className="sr-only">Editar perfil de {member.name}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 p-0">
        <DialogHeader className="border-border shrink-0 border-b px-6 py-4">
          <DialogTitle>Editar perfil · {member.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="member_id" value={member.id} />

          {/* Scrollable body */}
          <div className="scroll-fade no-scrollbar flex-1 overflow-y-auto px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mp-name" className="text-xs font-medium">
                  Nombre
                </FieldLabel>
                <Input
                  id="mp-name"
                  name="name"
                  defaultValue={member.name}
                  required
                  maxLength={160}
                  autoComplete="name"
                />
              </Field>

              <Field>
                <FieldLabel className="text-muted-foreground text-xs font-medium">Email</FieldLabel>
                <Input value={member.email} disabled aria-readonly />
                <FieldDescription>No editable desde aquí.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="mp-job" className="text-xs font-medium">
                  Cargo
                </FieldLabel>
                <Input
                  id="mp-job"
                  name="job_title"
                  defaultValue={member.jobTitle ?? ''}
                  placeholder="Account Executive"
                  maxLength={160}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="mp-phone" className="text-xs font-medium">
                  Teléfono
                </FieldLabel>
                <Input
                  id="mp-phone"
                  name="phone"
                  type="tel"
                  defaultValue={member.phone ?? ''}
                  placeholder="+34 600 000 000"
                  maxLength={30}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="mp-contact" className="text-xs font-medium">
                  Email de contacto
                </FieldLabel>
                <Input
                  id="mp-contact"
                  name="contact_email"
                  type="email"
                  defaultValue={member.contactEmail ?? ''}
                />
                <FieldDescription>Aparece en la firma.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="mp-alias" className="text-xs font-medium">
                  Alias de envío
                </FieldLabel>
                <Input
                  id="mp-alias"
                  name="email_alias"
                  type="email"
                  defaultValue={member.emailAlias ?? ''}
                />
                <FieldDescription>Dirección desde la que envía emails.</FieldDescription>
              </Field>

              {/* GitHub handle + avatar preview */}
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="mp-github" className="text-xs font-medium">
                  GitHub handle
                </FieldLabel>
                <div className="flex items-center gap-3">
                  <Avatar size="default" className="shrink-0">
                    {avatarSrc ? (
                      <AvatarImage src={avatarSrc} alt={member.name} referrerPolicy="no-referrer" />
                    ) : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="relative flex-1">
                    <Input
                      id="mp-github"
                      name="github_handle"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="usuario-github"
                      maxLength={39}
                      autoComplete="off"
                      spellCheck={false}
                      autoCapitalize="off"
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
              </Field>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="mp-avatar" className="text-xs font-medium">
                  URL de avatar personalizado
                </FieldLabel>
                <Input
                  id="mp-avatar"
                  name="avatar_url"
                  type="url"
                  defaultValue={member.avatarUrl ?? ''}
                  placeholder="https://..."
                />
                <FieldDescription>
                  Si está vacío y hay GitHub configurado, se usa la foto de GitHub.
                </FieldDescription>
              </Field>
            </div>
          </div>

          {/* Sticky footer — always visible */}
          <div className="border-border shrink-0 border-t px-6 py-3">
            <div className="flex items-center justify-end gap-3">
              <FormFeedback state={feedback.state} successLabel="Perfil guardado" />
              <SubmitButton pendingLabel="Guardando…" loading={feedback.pending}>
                Guardar
              </SubmitButton>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function GithubHandleIcon({ status }: { status: ReturnType<typeof useGithubHandle>['status'] }) {
  const cls = 'size-4'
  if (status === 'checking')
    return <Loader2 className={cn(cls, 'animate-spin text-muted-foreground')} aria-hidden />
  if (status === 'valid') return <CheckCircle2 className={cn(cls, 'text-success')} aria-hidden />
  if (status === 'not_found' || status === 'invalid')
    return <XCircle className={cn(cls, 'text-destructive')} aria-hidden />
  if (status === 'rate_limited' || status === 'error')
    return <AlertCircle className={cn(cls, 'text-muted-foreground')} aria-hidden />
  return null
}
