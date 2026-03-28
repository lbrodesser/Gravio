'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  einheiten: string[]
  onConfirm: (faktoren: Record<string, number>) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

export function EinheitenFaktorenDialog({
  open,
  einheiten,
  onConfirm,
  onCancel,
  isLoading,
}: Props): React.JSX.Element {
  const [faktoren, setFaktoren] = useState<Record<string, string>>(
    Object.fromEntries(einheiten.map((e) => [e, '1']))
  )

  function handleChange(einheit: string, value: string): void {
    setFaktoren((prev) => ({ ...prev, [einheit]: value }))
  }

  async function handleConfirm(): Promise<void> {
    const numericFaktoren: Record<string, number> = {}
    for (const [e, v] of Object.entries(faktoren)) {
      numericFaktoren[e] = parseFloat(v.replace(',', '.')) || 1
    }
    await onConfirm(numericFaktoren)
  }

  return (
    <Dialog open={open} onOpenChange={() => !isLoading && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Einheiten-Faktoren</DialogTitle>
          <DialogDescription>
            Multiplikator pro Einheit (z. B. 1.05 für 5% Zuschlag)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {einheiten.map((einheit) => (
            <div key={einheit} className="flex items-center gap-3">
              <Label className="w-16 shrink-0 font-mono">{einheit}</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={faktoren[einheit] ?? '1'}
                onChange={(e) => handleChange(einheit, e.target.value)}
                className="h-14"
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Zurück
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading} className="h-14">
            {isLoading ? 'Importiere…' : 'Importieren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
