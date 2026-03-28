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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BaustelleFormSchema,
  type BaustelleFormData,
} from '@/lib/validations/baustelle'
import {
  useCreateBaustelle,
  useUpdateBaustelle,
} from '@/hooks/use-baustellen'
import type { Baustelle } from '@/types'

interface BaustelleFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editBaustelle?: Baustelle | null
}

export function BaustelleFormSheet({
  open,
  onOpenChange,
  editBaustelle,
}: BaustelleFormSheetProps): React.JSX.Element {
  const isEditing = !!editBaustelle
  const createMutation = useCreateBaustelle()
  const updateMutation = useUpdateBaustelle()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BaustelleFormData>({
    resolver: zodResolver(BaustelleFormSchema) as Resolver<BaustelleFormData>,
    defaultValues: { name: '', adresse: null },
  })

  useEffect(() => {
    if (editBaustelle) {
      reset({ name: editBaustelle.name, adresse: editBaustelle.adresse })
    } else {
      reset({ name: '', adresse: null })
    }
  }, [editBaustelle, reset])

  async function onSubmit(data: BaustelleFormData): Promise<void> {
    if (isEditing) {
      const result = await updateMutation.mutateAsync({
        id: editBaustelle!.id,
        data,
      })
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
        className="h-auto rounded-t-xl px-4 pb-8"
      >
        <SheetHeader className="mb-6">
          <SheetTitle>
            {isEditing ? 'Baustelle bearbeiten' : 'Neue Baustelle'}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baustelle-name">Name *</Label>
            <Input
              id="baustelle-name"
              {...register('name')}
              placeholder="z.B. Bahnhofstr. 12"
              className="h-14 text-base"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="baustelle-adresse">Adresse</Label>
            <Input
              id="baustelle-adresse"
              {...register('adresse')}
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
