'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Position, Einheit } from '@/types'

const EINHEITEN: Einheit[] = ['m³', 'm²', 'm', 'Stk', 't']

export interface LvPositionOption {
  id: string
  kurztext: string
  einheit: string
}

interface PositionenEditorProps {
  positionen: Position[]
  onChange: (positionen: Position[]) => void
  lvPositionen?: LvPositionOption[]
}

export function PositionenEditor({
  positionen,
  onChange,
  lvPositionen,
}: PositionenEditorProps): React.JSX.Element {
  function addPosition(): void {
    onChange([
      ...positionen,
      { id: crypto.randomUUID(), name: '', einheit: 'm³', menge: null },
    ])
  }

  function removePosition(id: string): void {
    onChange(positionen.filter((p) => p.id !== id))
  }

  function updatePosition(
    id: string,
    field: keyof Position,
    value: string | number | null
  ): void {
    onChange(
      positionen.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  return (
    <div className="space-y-3">
      <Label>Positionen</Label>

      {positionen.map((position, index) => (
        <div key={position.id} className="flex gap-2 items-center">
          <Input
            placeholder={`Position ${index + 1}`}
            value={position.name}
            onChange={(e) => updatePosition(position.id, 'name', e.target.value)}
            className="h-14 text-base flex-1"
            aria-label={`Name Position ${index + 1}`}
          />
          <select
            value={position.einheit}
            onChange={(e) =>
              updatePosition(position.id, 'einheit', e.target.value as Einheit)
            }
            className="h-14 px-3 rounded-md border border-input bg-background text-base shrink-0"
            aria-label={`Einheit Position ${index + 1}`}
          >
            {EINHEITEN.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          {lvPositionen && lvPositionen.length > 0 && (
            <select
              value={position.lv_position_id ?? ''}
              onChange={(e) =>
                updatePosition(position.id, 'lv_position_id', e.target.value || null)
              }
              className="h-14 rounded-md border border-input bg-background px-3 text-sm flex-1"
              aria-label={`LV-Position ${index + 1}`}
            >
              <option value="">— kein LV —</option>
              {lvPositionen.map((lv) => (
                <option key={lv.id} value={lv.id}>
                  {lv.kurztext} ({lv.einheit})
                </option>
              ))}
            </select>
          )}
          <Input
            type="number"
            step="0.01"
            placeholder="Menge"
            value={position.menge ?? ''}
            onChange={(e) =>
              updatePosition(
                position.id,
                'menge',
                e.target.value ? Number(e.target.value) : null
              )
            }
            className="h-14 text-base w-24 shrink-0"
            aria-label={`Menge Position ${index + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removePosition(position.id)}
            className="h-14 w-14 shrink-0 text-destructive hover:text-destructive"
            aria-label={`Position ${index + 1} entfernen`}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addPosition}
        className="w-full h-14 gap-2 text-base"
      >
        <Plus className="h-5 w-5" />
        Position hinzufügen
      </Button>
    </div>
  )
}
