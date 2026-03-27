import { MobileHomeSkeleton } from '@/components/shared/mobile-home-skeleton'
import { Suspense } from 'react'
import { PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'

function SkizzenEmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="rounded-full bg-accent/10 p-5 mb-4">
        <PenLine className="h-12 w-12 text-accent" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-medium mt-2">Noch keine Skizzen</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs">
        Erstelle deine erste Baustellen-Skizze
      </p>
      <Button className="mt-6 w-full h-14 text-base" size="lg">
        Neue Skizze erstellen
      </Button>
    </div>
  )
}

export default function MobileHomePage(): React.JSX.Element {
  return (
    <div className="px-4 pt-6">
      <Suspense fallback={<MobileHomeSkeleton />}>
        <SkizzenEmptyState />
      </Suspense>
    </div>
  )
}
