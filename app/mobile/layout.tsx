import { MobileNav } from '@/components/layout/mobile-nav'

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 overflow-auto pb-[calc(64px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
