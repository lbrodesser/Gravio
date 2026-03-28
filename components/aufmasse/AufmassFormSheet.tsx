'use client'

import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AufmassWerteEditor } from './AufmassWerteEditor'
import {
  AufmassFormSchema,
  type AufmassFormData,
} from '@/lib/validations/aufmass'
import { useCreateAufmass } from '@/hooks/use-aufmasse'
import { useElementTemplates } from '@/hooks/use-element-templates'
import type { AufmassPositionWert } from '@/types'

interface AufmassFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  baustelleId: string
}

export function AufmassFormSheet({
  open,
  onOpenChange,
  baustelleId,
}: AufmassFormSheetProps): React.JSX.Element {
  const createMutation = useCreateAufmass()
  const { data: templates } = useElementTemplates()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AufmassFormData>({
    resolver: zodResolver(AufmassFormSchema) as Resolver<AufmassFormData>,
    defaultValues: {
      element_template_id: '',
      element_name: '',
      positionen_werte: [],
      notiz: null,
    },
  })

  const selectedTemplateId = watch('element_template_id')
  const positionen_werte = watch('positionen_werte')

  // When template changes: populate positionen_werte from template
  useEffect(() => {
    if (!selectedTemplateId || !templates) return
    const template = templates.find((t) => t.id === selectedTemplateId)
    if (!template) return
    setValue('element_name', template.name, { shouldDirty: true })
    const werte: AufmassPositionWert[] = template.positionen.map((p) => ({
      name: p.name,
      einheit: p.einheit,
      wert: p.menge,
    }))
    setValue('positionen_werte', werte, { shouldDirty: true })
  }, [selectedTemplateId, templates, setValue])

  // Reset on close
  useEffect(() => {
    if (!open) {
      reset({
        element_template_id: '',
        element_name: '',
        positionen_werte: [],
        notiz: null,
      })
    }
  }, [open, reset])

  async function onSubmit(data: AufmassFormData): Promise<void> {
    const result = await createMutation.mutateAsync({ baustelleId, data })
    if (!result.error) onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] overflow-y-auto rounded-t-xl px-4 pb-8"
      >
        <SheetHeader className="mb-6">
          <SheetTitle>Aufmaß erfassen</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label>Element *</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={(v) =>
                v !== null && setValue('element_template_id', v, { shouldDirty: true })
              }
            >
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Element auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.element_template_id && (
              <p className="text-sm text-destructive">
                {errors.element_template_id.message}
              </p>
            )}
          </div>

          {positionen_werte.length > 0 && (
            <div className="space-y-2">
              <Label>Maße</Label>
              <AufmassWerteEditor
                werte={positionen_werte}
                onChange={(w) =>
                  setValue('positionen_werte', w, { shouldDirty: true })
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="aufmass-notiz">Notiz</Label>
            <Input
              id="aufmass-notiz"
              {...register('notiz')}
              placeholder="Optional"
              className="h-14 text-base"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1 h-14 text-base"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              className="flex-1 h-14 text-base"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Speichern...' : 'Erfassen'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
