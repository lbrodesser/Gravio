'use client'

import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PositionenEditor } from './PositionenEditor'
import { z } from 'zod'
import {
  ElementTemplateFormSchema,
  type ElementTemplateFormData,
} from '@/lib/validations/element-template'
import { useCreateTemplate, useUpdateTemplate } from '@/hooks/use-element-templates'
import type { ElementTemplate } from '@/types'

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
      name: '',
      description: null,
      laenge: null,
      breite: null,
      tiefe: null,
      positionen: [],
    },
  })

  const positionen = useWatch({ control, name: 'positionen' }) ?? []

  useEffect(() => {
    if (editTemplate) {
      reset({
        name: editTemplate.name,
        description: editTemplate.description,
        laenge: editTemplate.laenge,
        breite: editTemplate.breite,
        tiefe: editTemplate.tiefe,
        positionen: editTemplate.positionen,
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
  }, [editTemplate, reset])

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

  return (
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

          <PositionenEditor
            positionen={positionen}
            onChange={(p) => setValue('positionen', p)}
          />

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
              {isPending ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
