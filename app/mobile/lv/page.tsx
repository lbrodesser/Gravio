'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLvGruppen } from '@/hooks/use-lv'
import { LvGruppeCard } from '@/components/lv/LvGruppeCard'
import { LvImportDialog } from '@/components/lv/LvImportDialog'

export default function MobileLvPage(): React.JSX.Element {
  const [importOpen, setImportOpen] = useState(false)
  const { data: gruppen, isLoading } = useLvGruppen()

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Leistungsverzeichnisse</h1>
        <Button size="icon" className="h-14 w-14" onClick={() => setImportOpen(true)}>
          <Plus className="h-6 w-6" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && (
          <>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </>
        )}

        {!isLoading && (!gruppen || gruppen.length === 0) && (
          <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
            <p className="text-muted-foreground">
              Noch kein Leistungsverzeichnis vorhanden
            </p>
            <Button className="h-14" onClick={() => setImportOpen(true)}>
              <Plus className="mr-2 h-5 w-5" />
              LV importieren
            </Button>
          </div>
        )}

        {!isLoading &&
          gruppen?.map((g) => <LvGruppeCard key={g.id} gruppe={g} />)}
      </div>

      <LvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
