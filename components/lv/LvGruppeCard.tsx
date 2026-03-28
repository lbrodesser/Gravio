'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDeleteLvGruppe, useLvPositionen } from '@/hooks/use-lv'
import type { LvGruppe } from '@/types/lv'

interface Props {
  gruppe: LvGruppe
}

export function LvGruppeCard({ gruppe }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const { data: positionen, isLoading } = useLvPositionen(expanded ? gruppe.id : null)
  const deleteGruppe = useDeleteLvGruppe()

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4 min-h-[56px]">
        <button
          type="button"
          className="flex-1 flex items-center gap-2 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium">{gruppe.name}</span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-destructive hover:text-destructive"
          onClick={() => deleteGruppe.mutate(gruppe.id)}
          disabled={deleteGruppe.isPending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t bg-muted/30">
          {isLoading && (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted animate-pulse" />
              ))}
            </div>
          )}
          {!isLoading && positionen && positionen.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Keine Positionen</p>
          )}
          {!isLoading && positionen && positionen.length > 0 && (
            <div className="divide-y">
              {positionen.map((pos) => (
                <div key={pos.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  {pos.artikelnr && (
                    <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">
                      {pos.artikelnr}
                    </span>
                  )}
                  <span className="flex-1">{pos.kurztext}</span>
                  <span className="text-muted-foreground shrink-0">{pos.einheit}</span>
                  <span className="font-mono shrink-0">
                    {pos.einheitspreis.toLocaleString('de-DE', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
