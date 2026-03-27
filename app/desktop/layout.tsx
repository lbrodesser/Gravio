import { DesktopSidebar } from '@/components/layout/desktop-sidebar'
import { CommandPalette } from '@/components/layout/command-palette'

export default function DesktopLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden">
      <DesktopSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <CommandPalette />
    </div>
  )
}
