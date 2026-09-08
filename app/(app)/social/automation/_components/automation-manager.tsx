'use client'

import {
  Activity,
  Globe2 as Facebook,
  Camera as Instagram,
  MessageCircle,
  Trash as Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@doscientos/ui'
import { Textarea } from '@/components/ui/textarea'
import type { AutomationRule, MetaPlatform } from '@/lib/social/automation/types'

import {
  createGlobalAutomationRule,
  deleteAutomationRule,
  setAutomationRuleActive,
} from '../../actions'

const PLATFORMS: { value: MetaPlatform; label: string; icon: typeof Instagram }[] = [
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'facebook', label: 'Facebook', icon: Facebook },
]

export function AutomationManager({ initialRules }: { initialRules: AutomationRule[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const feedback = useFormFeedback({ successResetMs: 4000 })
  const [keyword, setKeyword] = useState('')
  const [publicReply, setPublicReply] = useState('¡Gracias! Te hemos escrito por privado.')
  const [privateMessage, setPrivateMessage] = useState('')
  const [platforms, setPlatforms] = useState<Set<MetaPlatform>>(
    () => new Set<MetaPlatform>(['instagram', 'facebook']),
  )

  function togglePlatform(platform: MetaPlatform, checked: boolean) {
    setPlatforms((current) => {
      const next = new Set(current)
      if (checked) next.add(platform)
      else next.delete(platform)
      return next
    })
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (platforms.size === 0) {
      feedback.setError('Selecciona al menos una red.')
      return
    }
    feedback.setPending()
    startTransition(async () => {
      const result = await createGlobalAutomationRule({
        keyword,
        publicReply,
        privateMessage,
        platforms: [...platforms],
      })
      if (!result.ok) {
        feedback.setError(result.error)
        return
      }
      setKeyword('')
      setPrivateMessage('')
      feedback.setSuccess('Automatización guardada')
      router.refresh()
    })
  }

  function toggle(rule: AutomationRule, active: boolean) {
    startTransition(async () => {
      await setAutomationRuleActive({ ruleId: rule.id, active })
      router.refresh()
    })
  }

  function remove(rule: AutomationRule) {
    if (!window.confirm(`¿Eliminar la regla «${rule.keyword}»?`)) return
    startTransition(async () => {
      await deleteAutomationRule({ ruleId: rule.id })
      router.refresh()
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <MessageCircle className="size-4" />
                Nueva regla global
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-xs">
                Se usa cuando la publicación no tiene una regla específica.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/social/automation/runs">
                <Activity className="size-3.5" />
                Actividad
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <FormRow label="Palabra o frase" htmlFor="global-keyword" required>
              <Input
                id="global-keyword"
                value={keyword}
                maxLength={80}
                placeholder="doscientos"
                onChange={(event) => setKeyword(event.target.value)}
                disabled={pending}
              />
            </FormRow>
            <FormRow label="Respuesta pública" htmlFor="global-public" required>
              <Textarea
                id="global-public"
                rows={2}
                value={publicReply}
                maxLength={3000}
                onChange={(event) => setPublicReply(event.target.value)}
                disabled={pending}
              />
            </FormRow>
            <FormRow
              label="Mensaje privado"
              htmlFor="global-private"
              hint="Incluye el recurso o enlace relacionado con la publicación."
              required
            >
              <Textarea
                id="global-private"
                rows={4}
                value={privateMessage}
                maxLength={3000}
                placeholder="Gracias por tu interés. Puedes ver más aquí: https://..."
                onChange={(event) => setPrivateMessage(event.target.value)}
                disabled={pending}
              />
            </FormRow>
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium">Redes</Label>
              <div className="flex gap-2">
                {PLATFORMS.map(({ value, label, icon: Icon }) => (
                  <div
                    key={value}
                    className="border-border flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs"
                  >
                    <Checkbox
                      id={`global-platform-${value}`}
                      isSelected={platforms.has(value)}
                      onChange={togglePlatform.bind(null, value)}
                      isDisabled={pending}
                    />
                    <Label htmlFor={`global-platform-${value}`} className="flex items-center gap-2">
                      <Icon className="size-3.5" />
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-border flex items-center justify-between gap-3 border-t pt-4">
              <FormFeedback state={feedback.state} />
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? 'Guardando…' : 'Guardar regla'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Reglas activas y específicas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {initialRules.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Todavía no hay reglas. Empieza por una palabra que uses en tus campañas.
            </p>
          ) : (
            initialRules.map((rule) => (
              <div key={rule.id} className="border-border rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">{rule.keyword}</span>
                    <span className="text-muted-foreground text-[11px]">
                      {rule.postId ? 'Solo para una publicación' : 'Global'} · {rule.platform}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      aria-label={`Activar regla ${rule.keyword}`}
                      isSelected={rule.active}
                      onChange={(active) => toggle(rule, active)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Eliminar regla ${rule.keyword}`}
                      onClick={() => remove(rule)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-muted-foreground mt-3 text-xs">{rule.privateMessage}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
