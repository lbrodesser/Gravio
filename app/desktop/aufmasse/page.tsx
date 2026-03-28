'use client'

import { useState } from 'react'
import { Plus, HardHat, FileText, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BaustelleFormSheet } from '@/components/aufmasse/BaustelleFormSheet'
import { AufmassFormSheet } from '@/components/aufmasse/AufmassFormSheet'
import { AbrechnungCard } from '@/components/abrechnung/AbrechnungCard'
import { useBaustellen, useDeleteBaustelle } from '@/hooks/use-baustellen'
import { useAufmasse, useDeleteAufmass } from '@/hooks/use-aufmasse'
import { useLvGruppen } from '@/hooks/use-lv'
import { useAbrechnungenFuerBaustelle } from '@/hooks/use-abrechnungen'
import type { Aufmass, Baustelle } from '@/types'
import type { LvGruppe } from '@/types/lv'
import { cn } from '@/lib/utils'

export default function DesktopAufmassePage(): React.JSX.Element {
  const [selectedBaustelle, setSelectedBaustelle] = useState<Baustelle | null>(null)
  const [baustelleSheetOpen, setBaustelleSheetOpen] = useState(false)
  const [editBaustelle, setEditBaustelle] = useState<Baustelle | null>(null)
  const [aufmassSheetOpen, setAufmassSheetOpen] = useState(false)

  const { data: baustellen, isLoading: baustellenLoading, isError: baustellenError, refetch: refetchBaustellen } = useBaustellen()
  const deleteBaustelleMutation = useDeleteBaustelle()
  const { data: lvGruppen } = useLvGruppen()

  function handleNewBaustelle(): void {
    setEditBaustelle(null)
    setBaustelleSheetOpen(true)
  }

  function handleEditBaustelle(b: Baustelle): void {
    setEditBaustelle(b)
    setBaustelleSheetOpen(true)
  }

  async function handleDeleteBaustelle(b: Baustelle): Promise<void> {
    try {
      const result = await deleteBaustelleMutation.mutateAsync(b.id)
      if (!result.error && selectedBaustelle?.id === b.id) {
        setSelectedBaustelle(null)
      }
    } catch {
      // onError in useDeleteBaustelle handles rollback and toast
    }
  }

  return (
    <div className="flex h-full">
      {/* Left: Baustellen list */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <h2 className="font-semibold">Baustellen</h2>
          <Button size="sm" onClick={handleNewBaustelle} className="gap-1">
            <Plus className="h-4 w-4" />
            Neu
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {baustellenLoading ? (
            <DesktopListeSkeleton />
          ) : baustellenError ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">Fehler beim Laden.</p>
              <Button variant="outline" size="sm" onClick={() => void refetchBaustellen()}>Erneut versuchen</Button>
            </div>
          ) : !baustellen?.length ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
              <HardHat className="h-8 w-8 text-accent" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">Noch keine Baustellen</p>
            </div>
          ) : (
            <ul>
              {baustellen.map((b) => (
                <li key={b.id}>
                  <div className={cn('flex items-center border-b border-border group', selectedBaustelle?.id === b.id && 'bg-accent/10')}>
                    <button onClick={() => setSelectedBaustelle(b)} className="flex-1 min-w-0 text-left px-4 py-3 hover:bg-secondary transition-colors">
                      <p className="font-medium text-sm truncate">{b.name}</p>
                      {b.adresse && <p className="text-xs text-muted-foreground truncate">{b.adresse}</p>}
                    </button>
                    <div className="flex shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditBaustelle(b)} aria-label={`${b.name} bearbeiten`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => void handleDeleteBaustelle(b)} disabled={deleteBaustelleMutation.isPending && deleteBaustelleMutation.variables === b.id} aria-label={`${b.name} löschen`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right: Aufmaße */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {selectedBaustelle ? (
          <AufmassePanel baustelle={selectedBaustelle} onErfassen={() => setAufmassSheetOpen(true)} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Baustelle auswählen oder neue anlegen
          </div>
        )}
      </div>

      <BaustelleFormSheet open={baustelleSheetOpen} onOpenChange={setBaustelleSheetOpen} editBaustelle={editBaustelle} lvGruppen={lvGruppen ?? []} />
      {selectedBaustelle && (
        <AufmassFormSheet open={aufmassSheetOpen} onOpenChange={setAufmassSheetOpen} baustelleId={selectedBaustelle.id} />
      )}
    </div>
  )
}

function AufmassePanel({ baustelle, onErfassen }: { baustelle: Baustelle; onErfassen: () => void }): React.JSX.Element {
  const { data: aufmasse, isLoading, isError, refetch } = useAufmasse(baustelle.id)
  const deleteAufmassMutation = useDeleteAufmass()
  const { data: lvGruppen } = useLvGruppen()
  const { data: abrechnungen } = useAbrechnungenFuerBaustelle(baustelle.id)

  const lvGruppe: LvGruppe | null = lvGruppen?.find((g) => g.id === baustelle.lv_gruppe_id) ?? null
  const gesamtkosten = abrechnungen?.reduce((sum, a) => sum + a.gesamtsumme, 0) ?? 0

  return (
    <>
      <div className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate">{baustelle.name}</h2>
          {gesamtkosten > 0 && (
            <p className="text-xs text-muted-foreground">
              Gesamtkosten: {gesamtkosten.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </p>
          )}
        </div>
        <Button size="sm" onClick={onErfassen} className="gap-1 shrink-0 ml-4">
          <Plus className="h-4 w-4" />
          Aufmaß erfassen
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <AufmasseRechtsSeiteListeSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">Aufmaße konnten nicht geladen werden.</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>Erneut versuchen</Button>
          </div>
        ) : !aufmasse?.length ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center py-12">
            <FileText className="h-8 w-8 text-accent" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Noch keine Aufmaße — klicke auf &quot;Aufmaß erfassen&quot;</p>
          </div>
        ) : (
          <ul>
            {aufmasse.map((a) => (
              <DesktopAufmassItem
                key={a.id}
                aufmass={a}
                lvGruppe={lvGruppe}
                onDelete={() => deleteAufmassMutation.mutate({ id: a.id, baustelleId: baustelle.id })}
                isDeleting={deleteAufmassMutation.isPending && deleteAufmassMutation.variables?.id === a.id}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function DesktopAufmassItem({ aufmass, lvGruppe, onDelete, isDeleting }: { aufmass: Aufmass; lvGruppe: LvGruppe | null; onDelete: () => void; isDeleting: boolean }): React.JSX.Element {
  return (
    <li className="flex flex-col px-6 py-4 border-b border-border gap-3 group">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{aufmass.element_name}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {aufmass.positionen_werte.map((w, i) => (
              <span key={i} className="text-xs text-muted-foreground">
                {w.name}: <span className="text-foreground">{w.wert !== null ? `${w.wert} ${w.einheit}` : '—'}</span>
              </span>
            ))}
          </div>
          {aufmass.notiz && <p className="text-xs text-muted-foreground mt-1 italic">{aufmass.notiz}</p>}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={onDelete} disabled={isDeleting} aria-label={`${aufmass.element_name} löschen`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <AbrechnungCard aufmass={aufmass} lvGruppe={lvGruppe} />
    </li>
  )
}

function DesktopListeSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3].map((i) => (
        <li key={i} className="px-4 py-3 border-b border-border space-y-1">
          <div className="h-4 bg-muted rounded animate-pulse w-36" />
          <div className="h-3 bg-muted rounded animate-pulse w-24" />
        </li>
      ))}
    </ul>
  )
}

function AufmasseRechtsSeiteListeSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2].map((i) => (
        <li key={i} className="px-6 py-4 border-b border-border space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-32" />
          <div className="flex gap-4">
            <div className="h-3 bg-muted rounded animate-pulse w-20" />
            <div className="h-3 bg-muted rounded animate-pulse w-20" />
          </div>
        </li>
      ))}
    </ul>
  )
}
