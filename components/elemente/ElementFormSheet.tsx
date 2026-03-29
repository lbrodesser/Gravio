// components/elemente/ElementFormSheet.tsx
'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ListChecks } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { LvPositionenSheet } from './LvPositionenSheet'
import { z } from 'zod'
import {
  ElementTemplateFormSchema,
  type ElementTemplateFormData,
} from '@/lib/validations/element-template'
import { useCreateTemplate, useUpdateTemplate } from '@/hooks/use-element-templates'
import { useLvGruppen, useLvPositionen } from '@/hooks/use-lv'
import type { ElementTemplate, Einheit } from '@/types'

type ElementTemplateFormInput = z.input<typeof ElementTemplateFormSchema>

interface ElementFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editTemplate?: ElementTemplate | null
}

export function ElementFormSheet({
  open,
  onOpenChange,
  editTemplate,
}: ElementFormSheetProps): React.JSX.Element {
  const isEditing = !!editTemplate
  const [pickerOpen, setPickerOpen] = useState(false)
  const createMutation = useCreateTemplate()
  const updateMutation = useUpdateTemplate()
  const { data: lvGruppen = [] } = useLvGruppen()

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
  const currentLvId = (useWatch({ control, name: 'lv_gruppe_id' }) as string | null | undefined) ?? null

  const { data: lvPositionen = [], isLoading: lvLoading } = useLvPositionen(currentLvId)

  const lvPositionOptions: LvPositionOption[] = lvPositionen.map((p) => ({
    id: p.id,
    kurztext: p.kurztext,
    einheit: p.einheit,
  }))

  useEffect(() => {
    if (editTemplate) {
      reset({
        name: editTemplate.name,
        description: editTemplate.description,
        laenge: editTemplate.laenge,
        breite: editTemplate.breite,
        tiefe: editTemplate.tiefe,
        lv_gruppe_id: editTemplate.lv_gruppe_id,
        positionen: editTemplate.positionen,
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
  }, [editTemplate, reset])

  function handleLvChange(value: string | null): void {
    const newId = !value ? null : value
    setValue('lv_gruppe_id', newId, { shouldDirty: true })
    const manual = positionen.filter((p) => !p.lv_position_id)
    setValue('positionen', manual, { shouldDirty: true })
  }

  function handlePickerConfirm(selectedIds: string[]): void {
    const selectedSet = new Set(selectedIds)
    const kept = positionen.filter(
      (p) => !p.lv_position_id || selectedSet.has(p.lv_position_id)
    )
    const keptLvIds = new Set(kept.map((p) => p.lv_position_id).filter(Boolean))
    const toAdd = lvPositionOptions
      .filter((p) => selectedSet.has(p.id) && !keptLvIds.has(p.id))
      .map((p) => ({
        id: crypto.randomUUID(),
        name: p.kurztext,
        einheit: p.einheit as Einheit,
        menge: null,
        lv_position_id: p.id,
      }))
    setValue('positionen', [...kept, ...toAdd], { shouldDirty: true })
  }

  async function onSubmit(data: ElementTemplateFormData): Promise<void> {
    if (isEditing) {
      const result = await updateMutation.mutateAsync({ id: editTemplate.id, data })
      if (!result.error) onOpenChange(false)
    } else {
      const result = await createMutation.mutateAsync(data)
      if (!result.error) onOpenChange(false)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const addedLvIds = positionen
    .map((p) => p.lv_position_id)
    .filter((id): id is string => !!id)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[90vh] overflow-y-auto rounded-t-xl px-4 pb-8"
        >
          <SheetHeader className="mb-6">
            <SheetTitle>
              {isEditing ? 'Element bearbeiten' : 'Neues Element'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* LV-Auswahl */}
            <div className="space-y-2">
              <Label>Leistungsverzeichnis</Label>
              <Select
                value={currentLvId ?? ''}
                onValueChange={handleLvChange}
              >
                <SelectTrigger className="h-14">
                  <SelectValue placeholder="Leistungsverzeichnis auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {lvGruppen.map((lv) => (
                    <SelectItem key={lv.id} value={lv.id}>
                      {lv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sheet-name">Name *</Label>
              <Input
                id="sheet-name"
                {...register('name')}
                placeholder="z.B. Muffengrube"
                className="h-14 text-base"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sheet-desc">Beschreibung</Label>
              <Input
                id="sheet-desc"
                {...register('description')}
                placeholder="Optional"
                className="h-14 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label>Standardmaße (optional)</Label>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Länge (m)"
                  {...register('laenge', { valueAsNumber: true })}
                  className="h-14 text-base"
                  aria-label="Standardlänge in Metern"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Breite (m)"
                  {...register('breite', { valueAsNumber: true })}
                  className="h-14 text-base"
                  aria-label="Standardbreite in Metern"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Tiefe (m)"
                  {...register('tiefe', { valueAsNumber: true })}
                  className="h-14 text-base"
                  aria-label="Standardtiefe in Metern"
                />
              </div>
            </div>

            {/* Positionen */}
            {currentLvId ? (
              <div className="space-y-3">
                <PositionenListe
                  positionen={positionen}
                  onChange={(p) => setValue('positionen', p, { shouldDirty: true })}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                  className="w-full h-14 gap-2 text-base"
                  disabled={lvLoading}
                >
                  <ListChecks className="h-5 w-5" />
                  {lvLoading ? 'Lade Positionen…' : 'Positionen auswählen'}
                </Button>
              </div>
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

            <div className="flex gap-3 pt-4">
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
                disabled={isPending}
              >
                {isPending ? 'Speichern…' : 'Speichern'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Positions-Picker als separates Sheet */}
      <LvPositionenSheet
        key={pickerOpen ? 'picker-open' : 'picker-closed'}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        positionen={lvPositionOptions}
        initialSelectedIds={addedLvIds}
        onConfirm={handlePickerConfirm}
        isLoading={lvLoading}
      />
    </>
  )
}
