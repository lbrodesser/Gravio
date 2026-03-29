// components/elemente/PositionenListe.tsx
'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Position } from '@/types'

interface PositionenListeProps {
  positionen: Position[]
  onChange: (positionen: Position[]) => void
}

export function PositionenListe({
  positionen,
  onChange,
}: PositionenListeProps): React.JSX.Element {
  function updateMenge(id: string, value: string): void {
    onChange(
      positionen.map((p) =>
        p.id === id
          ? { ...p, menge: value ? Number(value) : null }
          : p
      )
    )
  }

  function remove(id: string): void {
    onChange(positionen.filter((p) => p.id !== id))
  }

  if (positionen.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Positionen</Label>
        <p className="text-sm text-muted-foreground py-2">
          Noch keine Positionen gewählt
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>Positionen ({positionen.length})</Label>
      <ul className="space-y-2">
        {positionen.map((pos) => (
          <li
            key={pos.id}
            className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{pos.name}</p>
              <p className="text-xs text-muted-foreground">{pos.einheit}</p>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Menge"
              value={pos.menge ?? ''}
              onChange={(e) => updateMenge(pos.id, e.target.value)}
              className="h-10 w-24 shrink-0 text-sm"
              aria-label={`Menge ${pos.name}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(pos.id)}
              className="h-14 w-14 shrink-0 text-destructive hover:text-destructive"
              aria-label={`${pos.name} entfernen`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
