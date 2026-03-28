'use client'

import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PositionenEditor } from './PositionenEditor'
import {
  ElementTemplateFormSchema,
  type ElementTemplateFormData,
} from '@/lib/validations/element-template'
import {
  useCreateTemplate,
  useUpdateTemplate,
} from '@/hooks/use-element-templates'
import type { ElementTemplate } from '@/types'

type ElementTemplateFormInput = z.input<typeof ElementTemplateFormSchema>

interface ElementDetailPanelProps {
  template: ElementTemplate | null
  onClose: () => void
  onDelete?: () => void
}

export function ElementDetailPanel({
  template,
  onClose,
  onDelete,
}: ElementDetailPanelProps): React.JSX.Element {
  const isEditing = !!template
  const createMutation = useCreateTemplate()
  const updateMutation = useUpdateTemplate()

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<ElementTemplateFormInput, unknown, ElementTemplateFormData>({
    resolver: zodResolver(ElementTemplateFormSchema),
    defaultValues: {
      name: template?.name ?? '',
      description: template?.description ?? null,
      laenge: template?.laenge ?? null,
      breite: template?.breite ?? null,
      tiefe: template?.tiefe ?? null,
      positionen: template?.positionen ?? [],
    },
  })

  const positionen = useWatch({ control, name: 'positionen' }) ?? []

  useEffect(() => {
    if (template) {
      reset({
        name: template.name,
        description: template.description,
        laenge: template.laenge,
        breite: template.breite,
        tiefe: template.tiefe,
        positionen: template.positionen,
      })
    } else {
      reset({
        name: '',
        description: null,
        laenge: null,
        breite: null,
        tiefe: null,
        positionen: [],
      })
    }
  }, [template, reset])

  async function onSubmit(data: ElementTemplateFormData): Promise<void> {
    if (isEditing) {
      const result = await updateMutation.mutateAsync({ id: template.id, data })
      if (!result.error) onClose()
    } else {
      const result = await createMutation.mutateAsync(data)
      if (!result.error) onClose()
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="p-6 max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">
          {isEditing ? 'Element bearbeiten' : 'Neues Element'}
        </h2>
        {isEditing && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            aria-label="Element löschen"
            disabled={isPending}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1">
          <Label htmlFor="panel-name">Name *</Label>
          <Input
            id="panel-name"
            {...register('name')}
            placeholder="z.B. Muffengrube"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="panel-desc">Beschreibung</Label>
          <Input
            id="panel-desc"
            {...register('description')}
            placeholder="Optional"
          />
        </div>

        <div className="space-y-1">
          <Label>Standardmaße (optional)</Label>
          <div className="grid grid-cols-3 gap-2">
            <Input
              type="number"
              step="0.01"
              placeholder="Länge (m)"
              {...register('laenge', { valueAsNumber: true })}
              aria-label="Standardlänge"
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Breite (m)"
              {...register('breite', { valueAsNumber: true })}
              aria-label="Standardbreite"
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Tiefe (m)"
              {...register('tiefe', { valueAsNumber: true })}
              aria-label="Standardtiefe"
            />
          </div>
        </div>

        <PositionenEditor
          positionen={positionen}
          onChange={(p) => setValue('positionen', p, { shouldDirty: true })}
        />
        {errors.positionen && (
          <p className="text-sm text-destructive">
            Alle Positionen benötigen einen Namen
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Abbrechen
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? 'Wird gespeichert…' : 'Speichern'}
          </Button>
        </div>
      </form>
    </div>
  )
}
