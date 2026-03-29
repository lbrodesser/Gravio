// components/elemente/ElementDetailPanel.tsx
'use client'

import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PositionenEditor, type LvPositionOption } from './PositionenEditor'
import { PositionenListe } from './PositionenListe'
import { LvPositionenPanel } from './LvPositionenPanel'
import {
  ElementTemplateFormSchema,
  type ElementTemplateFormData,
} from '@/lib/validations/element-template'
import {
  useCreateTemplate,
  useUpdateTemplate,
} from '@/hooks/use-element-templates'
import { useLvGruppen, useLvPositionen } from '@/hooks/use-lv'
import type { ElementTemplate, Einheit } from '@/types'

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
  const { data: lvGruppen = [] } = useLvGruppen()

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<ElementTemplateFormInput, unknown, ElementTemplateFormData>({
    resolver: zodResolver(ElementTemplateFormSchema),
    defaultValues: {
      name: '',
      description: null,
      laenge: null,
      breite: null,
      tiefe: null,
      lv_gruppe_id: null,
      positionen: [],
    },
  })

  const positionen = useWatch({ control, name: 'positionen' }) ?? []
  const currentLvId = (watch('lv_gruppe_id') as string | null | undefined) ?? null

  const { data: lvPositionen = [], isLoading: lvLoading } = useLvPositionen(currentLvId)

  const lvPositionOptions: LvPositionOption[] = lvPositionen.map((p) => ({
    id: p.id,
    kurztext: p.kurztext,
    einheit: p.einheit,
  }))

  const addedLvIds = new Set(
    positionen
      .map((p) => p.lv_position_id)
      .filter((id): id is string => !!id)
  )

  useEffect(() => {
    if (template) {
      reset({
        name: template.name,
        description: template.description,
        laenge: template.laenge,
        breite: template.breite,
        tiefe: template.tiefe,
        lv_gruppe_id: template.lv_gruppe_id,
        positionen: template.positionen,
      })
    } else {
      reset({
        name: '',
        description: null,
        laenge: null,
        breite: null,
        tiefe: null,
        lv_gruppe_id: null,
        positionen: [],
      })
    }
  }, [template, reset])

  function handleLvChange(value: string | null): void {
    const newId = value === '__none__' || value === null ? null : value
    setValue('lv_gruppe_id', newId ?? undefined, { shouldDirty: true })
    const manual = positionen.filter((p) => !p.lv_position_id)
    setValue('positionen', manual, { shouldDirty: true })
  }

  function handleAddPosition(pos: LvPositionOption): void {
    if (positionen.some((p) => p.lv_position_id === pos.id)) return
    setValue(
      'positionen',
      [
        ...positionen,
        {
          id: crypto.randomUUID(),
          name: pos.kurztext,
          einheit: pos.einheit as Einheit,
          menge: null,
          lv_position_id: pos.id,
        },
      ],
      { shouldDirty: true }
    )
  }

  function handleRemoveByLvId(lvPositionId: string): void {
    setValue(
      'positionen',
      positionen.filter((p) => p.lv_position_id !== lvPositionId),
      { shouldDirty: true }
    )
  }

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
    <div className="flex h-full">
      {/* Linke Seite: Formular */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0">
        <div className="max-w-md">
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
              <Label>Leistungsverzeichnis</Label>
              <Select
                value={currentLvId ?? '__none__'}
                onValueChange={handleLvChange}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="— kein LV —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— kein LV —</SelectItem>
                  {lvGruppen.map((lv) => (
                    <SelectItem key={lv.id} value={lv.id}>
                      {lv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentLvId && (
                <p className="text-xs text-muted-foreground">
                  Positionen rechts anklicken zum Hinzufügen
                </p>
              )}
            </div>

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

            {currentLvId ? (
              <PositionenListe
                positionen={positionen}
                onChange={(p) => setValue('positionen', p, { shouldDirty: true })}
              />
            ) : (
              <PositionenEditor
                positionen={positionen}
                onChange={(p) => setValue('positionen', p, { shouldDirty: true })}
              />
            )}

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
      </div>

      {/* Rechte Seite: LV-Positions-Browser (nur wenn LV aktiv) */}
      {currentLvId && (
        <div className="w-72 shrink-0 overflow-hidden flex flex-col">
          <LvPositionenPanel
            positionen={lvPositionOptions}
            addedIds={addedLvIds}
            onAdd={handleAddPosition}
            onRemove={handleRemoveByLvId}
            isLoading={lvLoading}
          />
        </div>
      )}
    </div>
  )
}
