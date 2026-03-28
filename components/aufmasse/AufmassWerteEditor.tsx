'use client'

import { Input } from '@/components/ui/input'
import type { AufmassPositionWert } from '@/types'

interface AufmassWerteEditorProps {
  werte: AufmassPositionWert[]
  onChange: (werte: AufmassPositionWert[]) => void
}

export function AufmassWerteEditor({
  werte,
  onChange,
}: AufmassWerteEditorProps): React.JSX.Element {
  if (werte.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Dieses Element hat keine Positionen.
      </p>
    )
  }

  function handleWertChange(index: number, raw: string): void {
    const updated = werte.map((w, i) => {
      if (i !== index) return w
      const parsed = parseFloat(raw)
      return { ...w, wert: raw === '' || isNaN(parsed) ? null : parsed }
    })
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      {werte.map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="flex-1 text-sm font-medium truncate">{w.name}</span>
          <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
            {w.einheit}
          </span>
          <Input
            type="number"
            step="0.01"
            placeholder="0"
            value={w.wert ?? ''}
            onChange={(e) => handleWertChange(i, e.target.value)}
            className="w-28 h-12 text-base text-right shrink-0"
            aria-label={`${w.name} in ${w.einheit}`}
          />
        </div>
      ))}
    </div>
  )
}
