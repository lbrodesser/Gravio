'use client'

import { PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function DesktopHomePage(): React.JSX.Element {
  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="flex flex-col items-center text-center max-w-sm w-full">
        <div className="rounded-full bg-accent/10 p-5 mb-4">
          <PenLine className="h-12 w-12 text-accent" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-medium mt-2">Noch keine Skizzen</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Erstelle deine erste Baustellen-Skizze
        </p>
        <Button
          className="mt-6 w-full"
          size="lg"
          onClick={() => toast.info('Skizzen-Funktion folgt in Kürze')}
        >
          Neue Skizze erstellen
        </Button>
      </div>
    </div>
  )
}
