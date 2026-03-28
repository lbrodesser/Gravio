'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PenLine, Layers, FileText, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/mobile/home', icon: PenLine, label: 'Skizze' },
  { href: '/mobile/elemente', icon: Layers, label: 'Elemente' },
  { href: '/mobile/aufmasse', icon: FileText, label: 'Aufmaße' },
  { href: '/mobile/lv', icon: FileText, label: 'Leistungsverzeichnis' },
  { href: '/mobile/einstellungen', icon: Settings, label: 'Einstellungen' },
] as const

export function MobileNav(): React.JSX.Element {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Hauptnavigation"
    >
      <div className="flex items-stretch h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 min-h-[56px] gap-1',
                'transition-colors duration-150 ease-out',
                'relative',
                isActive
                  ? 'text-accent'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-accent"
                  aria-hidden="true"
                />
              )}
              <Icon className="h-6 w-6" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[11px] font-medium leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
