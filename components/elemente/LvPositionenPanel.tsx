// components/elemente/LvPositionenPanel.tsx
'use client'

import { useState } from 'react'
import { Search, Check, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { LvPositionOption } from './PositionenEditor'

interface LvPositionenPanelProps {
  positionen: LvPositionOption[]
  addedIds: Set<string>
  onAdd: (pos: LvPositionOption) => void
  onRemove: (id: string) => void
  isLoading: boolean
}

export function LvPositionenPanel({
  positionen,
  addedIds,
  onAdd,
  onRemove,
  isLoading,
}: LvPositionenPanelProps): React.JSX.Element {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? positionen.filter((p) =>
        p.kurztext.toLowerCase().includes(query.toLowerCase())
      )
    : positionen

  return (
    <div className="flex flex-col h-full border-l border-border">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <p className="text-sm font-semibold mb-2">LV-Positionen</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Suchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LvPanelSkeleton />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 px-4">
            {query ? 'Keine Treffer' : 'Keine Positionen im LV'}
          </p>
        ) : (
          <ul>
            {filtered.map((pos) => {
              const isAdded = addedIds.has(pos.id)
              return (
                <li key={pos.id}>
                  <button
                    type="button"
                    onClick={() => (isAdded ? onRemove(pos.id) : onAdd(pos))}
                    className={cn(
                      'w-full text-left flex items-center gap-3 px-4 py-3',
                      'border-b border-border transition-colors duration-100',
                      isAdded
                        ? 'bg-accent/10 hover:bg-accent/20'
                        : 'hover:bg-secondary'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{pos.kurztext}</p>
                      <p className="text-xs text-muted-foreground">{pos.einheit}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 flex items-center justify-center h-6 w-6 rounded-full',
                        isAdded
                          ? 'bg-accent text-accent-foreground'
                          : 'border border-border text-muted-foreground'
                      )}
                    >
                      {isAdded ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function LvPanelSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="px-4 py-3 border-b border-border space-y-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-12" />
        </li>
      ))}
    </ul>
  )
}
