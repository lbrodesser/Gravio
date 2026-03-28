'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Plus, ArrowLeft, FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AufmassFormSheet } from '@/components/aufmasse/AufmassFormSheet'
import { AbrechnungCard } from '@/components/abrechnung/AbrechnungCard'
import { useBaustellen } from '@/hooks/use-baustellen'
import { useAufmasse, useDeleteAufmass } from '@/hooks/use-aufmasse'
import { useLvGruppen } from '@/hooks/use-lv'
import { useAbrechnungenFuerBaustelle } from '@/hooks/use-abrechnungen'
import type { Aufmass } from '@/types'
import type { LvGruppe } from '@/types/lv'

export default function MobileAufmasseDetailPage(): React.JSX.Element {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data: baustellen } = useBaustellen()
  const baustelle = baustellen?.find((b) => b.id === id)
  const { data: aufmasse, isLoading, isError, refetch } = useAufmasse(id)
  const deleteMutation = useDeleteAufmass()
  const { data: lvGruppen } = useLvGruppen()
  const { data: abrechnungen } = useAbrechnungenFuerBaustelle(id)

  const lvGruppe: LvGruppe | null = lvGruppen?.find((g) => g.id === baustelle?.lv_gruppe_id) ?? null
  const gesamtkosten = abrechnungen?.reduce((sum, a) => sum + a.gesamtsumme, 0) ?? 0

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 h-16 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-14 w-14 shrink-0" onClick={() => router.back()} aria-label="Zurück">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{baustelle?.name ?? 'Aufmaße'}</h1>
          {gesamtkosten > 0 && (
            <p className="text-xs text-muted-foreground">
              Gesamtkosten: {gesamtkosten.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </p>
          )}
        </div>
        <Button size="icon" onClick={() => setSheetOpen(true)} className="h-14 w-14">
          <Plus className="h-5 w-5" />
          <span className="sr-only">Aufmaß erfassen</span>
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {isLoading ? (
          <AufmasseListeSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
            <p className="text-muted-foreground text-sm">Aufmaße konnten nicht geladen werden.</p>
            <Button variant="outline" className="h-14" onClick={() => void refetch()}>Erneut versuchen</Button>
          </div>
        ) : !aufmasse?.length ? (
          <AufmasseEmptyState onCreateClick={() => setSheetOpen(true)} />
        ) : (
          <ul>
            {aufmasse.map((a) => (
              <AufmassListItem
                key={a.id}
                aufmass={a}
                lvGruppe={lvGruppe}
                onDelete={() => deleteMutation.mutate({ id: a.id, baustelleId: id })}
                isDeleting={deleteMutation.isPending && deleteMutation.variables?.id === a.id}
              />
            ))}
          </ul>
        )}
      </main>

      <AufmassFormSheet open={sheetOpen} onOpenChange={setSheetOpen} baustelleId={id} />
    </div>
  )
}

function AufmassListItem({ aufmass, lvGruppe, onDelete, isDeleting }: { aufmass: Aufmass; lvGruppe: LvGruppe | null; onDelete: () => void; isDeleting: boolean }): React.JSX.Element {
  const filledCount = aufmass.positionen_werte.filter((w) => w.wert !== null).length
  return (
    <li className="flex flex-col px-4 py-4 border-b border-border gap-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-base">{aufmass.element_name}</p>
          <div className="mt-1 space-y-0.5">
            {aufmass.positionen_werte.map((w, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {w.name}: <span className="text-foreground">{w.wert !== null ? `${w.wert} ${w.einheit}` : '—'}</span>
              </p>
            ))}
          </div>
          {aufmass.notiz && <p className="text-xs text-muted-foreground mt-1 italic">{aufmass.notiz}</p>}
          <p className="text-xs text-muted-foreground mt-1">{filledCount}/{aufmass.positionen_werte.length} Maße eingetragen</p>
        </div>
        <Button variant="ghost" size="icon" className="h-14 w-14 shrink-0 text-destructive hover:text-destructive" onClick={onDelete} disabled={isDeleting} aria-label={`${aufmass.element_name} löschen`}>
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
      <AbrechnungCard aufmass={aufmass} lvGruppe={lvGruppe} />
    </li>
  )
}

function AufmasseListeSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3].map((i) => (
        <li key={i} className="px-4 py-4 border-b border-border space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-36" />
          <div className="h-3 bg-muted rounded animate-pulse w-48" />
        </li>
      ))}
    </ul>
  )
}

function AufmasseEmptyState({ onCreateClick }: { onCreateClick: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
      <FileText className="h-12 w-12 text-accent" strokeWidth={1.5} />
      <div>
        <p className="font-semibold text-lg">Noch keine Aufmaße</p>
        <p className="text-muted-foreground text-sm mt-1">Erfasse dein erstes Aufmaß für diese Baustelle</p>
      </div>
      <Button onClick={onCreateClick} className="h-14 px-8 text-base">Aufmaß erfassen</Button>
    </div>
  )
}
