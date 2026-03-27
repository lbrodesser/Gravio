'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  PenLine,
  Layers,
  FileText,
  Settings,
  Plus,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'

export function CommandPalette(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = useCallback((command: () => void): void => {
    setOpen(false)
    command()
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 max-w-[560px]">
        <Command>
          <CommandInput placeholder="Befehl suchen oder tippen..." />
          <CommandList>
            <CommandEmpty>Keine Ergebnisse für diese Suche</CommandEmpty>

            <CommandGroup heading="Navigation">
              <CommandItem
                onSelect={() => runCommand(() => router.push('/desktop/home'))}
              >
                <PenLine className="mr-2 h-4 w-4" />
                Zur Skizze
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => router.push('/desktop/elemente'))}
              >
                <Layers className="mr-2 h-4 w-4" />
                Elemente verwalten
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => router.push('/desktop/aufmasse'))}
              >
                <FileText className="mr-2 h-4 w-4" />
                Aufmaße
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => router.push('/desktop/einstellungen'))}
              >
                <Settings className="mr-2 h-4 w-4" />
                Einstellungen
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Aktionen">
              <CommandItem onSelect={() => runCommand(() => {})}>
                <Plus className="mr-2 h-4 w-4" />
                Neue Skizze erstellen
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => {})}>
                <Plus className="mr-2 h-4 w-4" />
                Element hinzufügen
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
