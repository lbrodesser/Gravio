'use client'

import { useState } from 'react'
import { Plus, Layers, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ElementFormSheet } from '@/components/elemente/ElementFormSheet'
import {
  useElementTemplates,
  useDeleteTemplate,
} from '@/hooks/use-element-templates'
import type { ElementTemplate } from '@/types'

export default function MobileElementePage(): React.JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<ElementTemplate | null>(null)
  const { data: templates, isLoading, isError, refetch } = useElementTemplates()
  const deleteMutation = useDeleteTemplate()

  function handleEdit(template: ElementTemplate): void {
    setEditTemplate(template)
    setSheetOpen(true)
  }

  function handleNew(): void {
    setEditTemplate(null)
    setSheetOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 h-16 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold">Elemente</h1>
        <Button size="icon" onClick={handleNew} className="h-10 w-10">
          <Plus className="h-5 w-5" />
          <span className="sr-only">Neues Element</span>
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {isLoading ? (
          <ElementeListeSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
            <p className="text-muted-foreground text-sm">Elemente konnten nicht geladen werden.</p>
            <Button variant="outline" className="h-14" onClick={() => void refetch()}>
              Erneut versuchen
            </Button>
          </div>
        ) : !templates?.length ? (
          <ElementeEmptyState onCreateClick={handleNew} />
        ) : (
          <ul>
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex items-center px-4 min-h-[72px] border-b border-border gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-base truncate">
                    {template.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {template.positionen.length}{' '}
                    {template.positionen.length === 1
                      ? 'Position'
                      : 'Positionen'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-14 w-14 shrink-0"
                  onClick={() => handleEdit(template)}
                  aria-label={`${template.name} bearbeiten`}
                >
                  <Pencil className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-14 w-14 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(template.id)}
                  disabled={deleteMutation.isPending}
                  aria-label={`${template.name} löschen`}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <ElementFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editTemplate={editTemplate}
      />
    </div>
  )
}

function ElementeListeSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3].map((i) => (
        <li
          key={i}
          className="flex items-center px-4 min-h-[72px] border-b border-border gap-3"
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-40" />
            <div className="h-3 bg-muted rounded animate-pulse w-24" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ElementeEmptyState({
  onCreateClick,
}: {
  onCreateClick: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
      <Layers className="h-12 w-12 text-accent" strokeWidth={1.5} />
      <div>
        <p className="font-semibold text-lg">
          Noch keine Elemente definiert
        </p>
        <p className="text-muted-foreground text-sm mt-1">
          Definiere dein erstes Element — z.B. eine Muffengrube
        </p>
      </div>
      <Button onClick={onCreateClick} className="h-14 px-8 text-base">
        Element erstellen
      </Button>
    </div>
  )
}
