'use client'

import { useState } from 'react'
import { Plus, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLvGruppen, useLvPositionen } from '@/hooks/use-lv'
import { LvImportDialog } from '@/components/lv/LvImportDialog'
import type { LvGruppe } from '@/types/lv'

export default function DesktopLvPage(): React.JSX.Element {
  const [importOpen, setImportOpen] = useState(false)
  const [selectedGruppe, setSelectedGruppe] = useState<LvGruppe | null>(null)
  const { data: gruppen, isLoading } = useLvGruppen()
  const { data: positionen, isLoading: posLoading } = useLvPositionen(
    selectedGruppe?.id ?? null
  )

  return (
    <div className="flex h-full">
      {/* Linke Spalte: LV-Gruppen */}
      <aside className="w-72 border-r flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">Leistungsverzeichnisse</h2>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Import
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {isLoading &&
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted animate-pulse" />
            ))}
          {!isLoading && (!gruppen || gruppen.length === 0) && (
            <div className="p-2 space-y-2">
              <p className="text-sm text-muted-foreground">Kein LV vorhanden</p>
              <Button size="sm" variant="outline" className="w-full" onClick={() => setImportOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                LV importieren
              </Button>
            </div>
          )}
          {gruppen?.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGruppe(g)}
              className={`w-full text-left px-3 py-3 rounded-md text-sm transition-colors min-h-[44px] ${
                selectedGruppe?.id === g.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </aside>

      {/* Rechte Spalte: Positionen */}
      <main className="flex-1 overflow-y-auto">
        {!selectedGruppe && !isLoading && (!gruppen || gruppen.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <ClipboardList className="h-12 w-12 opacity-40" />
            <p className="text-sm">Noch kein Leistungsverzeichnis importiert</p>
            <Button onClick={() => setImportOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              LV importieren
            </Button>
          </div>
        )}
        {!selectedGruppe && (isLoading || (gruppen && gruppen.length > 0)) && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">LV auswählen</p>
          </div>
        )}
        {selectedGruppe && (
          <>
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{selectedGruppe.name}</h2>
              <p className="text-sm text-muted-foreground">
                {positionen?.length ?? '–'} Positionen
              </p>
            </div>
            <div className="divide-y">
              {posLoading &&
                [...Array(6)].map((_, i) => (
                  <div key={i} className="px-6 py-4 h-14 bg-muted/30 animate-pulse" />
                ))}
              {!posLoading &&
                positionen?.map((pos) => (
                  <div key={pos.id} className="px-6 py-3 flex items-center gap-4 text-sm">
                    {pos.artikelnr && (
                      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">
                        {pos.artikelnr}
                      </span>
                    )}
                    <span className="flex-1">{pos.kurztext}</span>
                    <span className="text-muted-foreground w-12 text-right shrink-0">
                      {pos.einheit}
                    </span>
                    <span className="font-mono w-28 text-right shrink-0">
                      {pos.einheitspreis.toLocaleString('de-DE', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}
      </main>

      <LvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
