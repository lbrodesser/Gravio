'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, HardHat, Pencil, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BaustelleFormSheet } from '@/components/aufmasse/BaustelleFormSheet'
import { useBaustellen } from '@/hooks/use-baustellen'
import { useLvGruppen } from '@/hooks/use-lv'
import type { Baustelle } from '@/types'

export default function MobileAufmassePage(): React.JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editBaustelle, setEditBaustelle] = useState<Baustelle | null>(null)
  const router = useRouter()
  const { data: baustellen, isLoading, isError, refetch } = useBaustellen()
  const { data: lvGruppen } = useLvGruppen()

  function handleNew(): void {
    setEditBaustelle(null)
    setSheetOpen(true)
  }

  function handleEdit(b: Baustelle): void {
    setEditBaustelle(b)
    setSheetOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 h-16 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold">Aufmaße</h1>
        <Button size="icon" onClick={handleNew} className="h-14 w-14">
          <Plus className="h-5 w-5" />
          <span className="sr-only">Neue Baustelle</span>
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {isLoading ? (
          <BaustellenListeSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
            <p className="text-muted-foreground text-sm">Baustellen konnten nicht geladen werden.</p>
            <Button variant="outline" className="h-14" onClick={() => void refetch()}>Erneut versuchen</Button>
          </div>
        ) : !baustellen?.length ? (
          <BaustellenEmptyState onCreateClick={handleNew} />
        ) : (
          <ul>
            {baustellen.map((b) => (
              <li key={b.id} className="flex items-center px-4 min-h-[72px] border-b border-border gap-3">
                <button className="flex-1 min-w-0 text-left py-2" onClick={() => router.push(`/mobile/aufmasse/${b.id}`)}>
                  <p className="font-medium text-base truncate">{b.name}</p>
                  {b.adresse && <p className="text-sm text-muted-foreground truncate">{b.adresse}</p>}
                </button>
                <Button variant="ghost" size="icon" className="h-14 w-14 shrink-0" onClick={() => handleEdit(b)} aria-label={`${b.name} bearbeiten`}>
                  <Pencil className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-14 w-14 shrink-0 text-muted-foreground" onClick={() => router.push(`/mobile/aufmasse/${b.id}`)} aria-label={`${b.name} öffnen`}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <BaustelleFormSheet open={sheetOpen} onOpenChange={setSheetOpen} editBaustelle={editBaustelle} lvGruppen={lvGruppen ?? []} />
    </div>
  )
}

function BaustellenListeSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3].map((i) => (
        <li key={i} className="flex items-center px-4 min-h-[72px] border-b border-border gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-40" />
            <div className="h-3 bg-muted rounded animate-pulse w-24" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function BaustellenEmptyState({ onCreateClick }: { onCreateClick: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
      <HardHat className="h-12 w-12 text-accent" strokeWidth={1.5} />
      <div>
        <p className="font-semibold text-lg">Noch keine Baustellen</p>
        <p className="text-muted-foreground text-sm mt-1">Leg deine erste Baustelle an</p>
      </div>
      <Button onClick={onCreateClick} className="h-14 px-8 text-base">Baustelle anlegen</Button>
    </div>
  )
}
