// components/elemente/ElementCreateDialog.tsx
'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  ElementTemplateFormSchema,
  type ElementTemplateFormData,
} from '@/lib/validations/element-template'
import { useCreateTemplate } from '@/hooks/use-element-templates'
import { useLvGruppen } from '@/hooks/use-lv'

type ElementTemplateFormInput = z.input<typeof ElementTemplateFormSchema>

interface ElementCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ElementCreateDialog({
  open,
  onOpenChange,
}: ElementCreateDialogProps): React.JSX.Element {
  const createMutation = useCreateTemplate()
  const { data: lvGruppen = [] } = useLvGruppen()

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    setError,
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

  const currentLvId = (useWatch({ control, name: 'lv_gruppe_id' }) as string | null | undefined) ?? null

  function handleOpenChange(v: boolean): void {
    if (!v) reset()
    onOpenChange(v)
  }

  async function onSubmit(data: ElementTemplateFormData): Promise<void> {
    if (!data.lv_gruppe_id) {
      setError('lv_gruppe_id' as never, {
        message: 'Bitte ein Leistungsverzeichnis auswählen',
      })
      return
    }
    const result = await createMutation.mutateAsync(data)
    if (!result.error) {
      reset()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neues Element</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label>
              Leistungsverzeichnis <span className="text-destructive">*</span>
            </Label>
            <Select
              value={currentLvId ?? ''}
              onValueChange={(v) =>
                setValue('lv_gruppe_id', v || null, { shouldDirty: true })
              }
            >
              <SelectTrigger>
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
            {(errors as Record<string, { message?: string }>)['lv_gruppe_id']
              ?.message && (
              <p className="text-xs text-destructive">
                {
                  (errors as Record<string, { message?: string }>)[
                    'lv_gruppe_id'
                  ]?.message
                }
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="create-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-name"
              {...register('name')}
              placeholder="z.B. Muffengrube"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="create-desc">Beschreibung</Label>
            <Input
              id="create-desc"
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
                aria-label="Länge in Metern"
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Breite (m)"
                {...register('breite', { valueAsNumber: true })}
                aria-label="Breite in Metern"
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Tiefe (m)"
                {...register('tiefe', { valueAsNumber: true })}
                aria-label="Tiefe in Metern"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Speichern…' : 'Speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
