'use client'

import { useState } from 'react'
import { Plus, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ElementDetailPanel } from '@/components/elemente/ElementDetailPanel'
import {
  useElementTemplates,
  useDeleteTemplate,
} from '@/hooks/use-element-templates'
import type { ElementTemplate } from '@/types'
import { cn } from '@/lib/utils'

export default function DesktopElementePage(): React.JSX.Element {
  const [selected, setSelected] = useState<ElementTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const { data: templates, isLoading, isError, refetch } = useElementTemplates()
  const deleteMutation = useDeleteTemplate()

  function handleNew(): void {
    setSelected(null)
    setIsCreating(true)
  }

  function handleSelect(template: ElementTemplate): void {
    setSelected(template)
    setIsCreating(false)
  }

  function handlePanelClose(): void {
    setSelected(null)
    setIsCreating(false)
  }

  async function handleDelete(id: string): Promise<void> {
    try {
      const result = await deleteMutation.mutateAsync(id)
      if (!result.error) handlePanelClose()
    } catch {
      // onError in useDeleteTemplate handles rollback and toast
    }
  }

  const showPanel = isCreating || selected !== null

  return (
    <div className="flex h-full">
      {/* Linke Spalte: Liste */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <h2 className="font-semibold">Elemente</h2>
          <Button size="sm" onClick={handleNew} className="gap-1">
            <Plus className="h-4 w-4" />
            Neu
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <DesktopListeSkeleton />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center py-12">
              <p className="text-sm text-muted-foreground">
                Elemente konnten nicht geladen werden.
              </p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Erneut versuchen
              </Button>
            </div>
          ) : !templates?.length ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center py-12">
              <Layers className="h-8 w-8 text-accent" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">
                Noch keine Elemente — klicke auf &quot;Neu&quot;
              </p>
            </div>
          ) : (
            <ul>
              {templates.map((template) => (
                <li key={template.id}>
                  <button
                    onClick={() => handleSelect(template)}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-border',
                      'hover:bg-secondary transition-colors duration-150',
                      selected?.id === template.id && 'bg-accent/10'
                    )}
                  >
                    <p className="font-medium text-sm truncate">
                      {template.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {template.positionen.length}{' '}
                      {template.positionen.length === 1
                        ? 'Position'
                        : 'Positionen'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Rechte Seite: Detail / Erstellen */}
      <div className="flex-1 overflow-y-auto">
        {showPanel ? (
          <ElementDetailPanel
            template={selected}
            onClose={handlePanelClose}
            onDelete={selected ? () => handleDelete(selected.id) : undefined}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Wähle ein Element aus der Liste oder erstelle ein neues
          </div>
        )}
      </div>
    </div>
  )
}

function DesktopListeSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3].map((i) => (
        <li key={i} className="px-4 py-3 border-b border-border space-y-1">
          <div className="h-4 bg-muted rounded animate-pulse w-32" />
          <div className="h-3 bg-muted rounded animate-pulse w-20" />
        </li>
      ))}
    </ul>
  )
}
