'use client'

import { useState } from 'react'
import { FileText, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useAbrechnungFuerAufmass,
  useCreateAbrechnung,
} from '@/hooks/use-abrechnungen'
import { useLvPositionen } from '@/hooks/use-lv'
import { ExportButton } from './ExportButton'
import type { Aufmass } from '@/types/index'
import type { LvGruppe } from '@/types/lv'

interface Props {
  aufmass: Aufmass
  lvGruppe: LvGruppe | null
}

export function AbrechnungCard({ aufmass, lvGruppe }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const { data: abrechnung, isLoading } = useAbrechnungFuerAufmass(aufmass.id)
  const { data: lvPositionen } = useLvPositionen(lvGruppe?.id ?? null)
  const createAbrechnung = useCreateAbrechnung()

  function handleCreate(): void {
    createAbrechnung.mutate({
      aufmassId: aufmass.id,
      baustelleId: aufmass.baustelle_id,
      aufmassName: aufmass.element_name,
      positionenWerte: aufmass.positionen_werte,
      lvPositionen: lvPositionen ?? [],
    })
  }

  if (isLoading) {
    return <div className="h-16 rounded-lg bg-muted animate-pulse" />
  }

  if (!abrechnung) {
    return (
      <div className="border rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span className="text-sm">Keine Abrechnung</span>
        </div>
        <Button
          size="sm"
          className="h-14"
          onClick={handleCreate}
          disabled={createAbrechnung.isPending}
        >
          <Plus className="mr-1 h-4 w-4" />
          Abrechnung erstellen
        </Button>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 min-h-[56px] text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1">
          <div className="font-medium">{abrechnung.name}</div>
          <div className="text-sm text-muted-foreground">
            Gesamt:{' '}
            {abrechnung.gesamtsumme.toLocaleString('de-DE', {
              style: 'currency',
              currency: 'EUR',
            })}
          </div>
        </div>
        <ExportButton abrechnungId={abrechnung.id} />
      </button>

      {expanded && (
        <div className="border-t divide-y bg-muted/30">
          {abrechnung.positionen.map((pos) => (
            <div key={pos.id} className="px-4 py-3 flex items-center gap-3 text-sm">
              <span className="flex-1">{pos.positionsname}</span>
              <span className="text-muted-foreground">{pos.menge} {pos.einheit}</span>
              <span className="font-mono text-right shrink-0">
                {(pos.gesamtpreis ?? 0).toLocaleString('de-DE', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
