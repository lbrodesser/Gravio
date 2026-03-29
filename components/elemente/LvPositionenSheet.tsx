// components/elemente/LvPositionenSheet.tsx
'use client'

import { useState, useEffect } from 'react'
import { Search, Check } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { LvPositionOption } from './PositionenEditor'

interface LvPositionenSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  positionen: LvPositionOption[]
  initialSelectedIds: string[]
  onConfirm: (selectedIds: string[]) => void
  isLoading: boolean
}

export function LvPositionenSheet({
  open,
  onOpenChange,
  positionen,
  initialSelectedIds,
  onConfirm,
  isLoading,
}: LvPositionenSheetProps): React.JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelectedIds)
  )
  const [query, setQuery] = useState('')

  // Wenn das Sheet geöffnet wird, Selektion neu initialisieren
  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelectedIds))
      setQuery('')
    }
  }, [open, initialSelectedIds])

  const filtered = query.trim()
    ? positionen.filter((p) =>
        p.kurztext.toLowerCase().includes(query.toLowerCase())
      )
    : positionen

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleConfirm(): void {
    onConfirm(Array.from(selected))
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] flex flex-col rounded-t-xl p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <SheetTitle>Positionen auswählen</SheetTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Suchen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-12 text-base"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <MobilePickerSkeleton />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12 px-4">
              {query ? 'Keine Treffer' : 'Keine Positionen im LV'}
            </p>
          ) : (
            <ul>
              {filtered.map((pos) => {
                const isSelected = selected.has(pos.id)
                return (
                  <li key={pos.id}>
                    <button
                      type="button"
                      onClick={() => toggle(pos.id)}
                      className={cn(
                        'w-full text-left flex items-center gap-4 px-4 min-h-[64px]',
                        'border-b border-border transition-colors duration-100',
                        isSelected ? 'bg-accent/10' : 'hover:bg-secondary'
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0 flex items-center justify-center h-6 w-6 rounded border-2',
                          isSelected
                            ? 'bg-accent border-accent'
                            : 'border-muted-foreground'
                        )}
                      >
                        {isSelected && (
                          <Check className="h-4 w-4 text-accent-foreground" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium truncate">
                          {pos.kurztext}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {pos.einheit}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="px-4 py-4 border-t border-border shrink-0">
          <Button
            onClick={handleConfirm}
            className="w-full h-14 text-base"
          >
            Übernehmen ({selected.size})
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MobilePickerSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="flex items-center gap-4 px-4 min-h-[64px] border-b border-border">
          <Skeleton className="h-6 w-6 rounded shrink-0" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-12" />
          </div>
        </li>
      ))}
    </ul>
  )
}
