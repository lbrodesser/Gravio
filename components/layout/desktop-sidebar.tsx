'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  PenLine,
  Layers,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

const navItems = [
  { href: '/desktop/home', icon: PenLine, label: 'Skizze' },
  { href: '/desktop/elemente', icon: Layers, label: 'Elemente' },
  { href: '/desktop/aufmasse', icon: FileText, label: 'Aufmaße' },
  { href: '/desktop/lv', icon: FileText, label: 'Leistungsverzeichnis' },
  { href: '/desktop/einstellungen', icon: Settings, label: 'Einstellungen' },
] as const

export function DesktopSidebar(): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserClient()
  const { user } = useAuth()

  const handleSignOut = async (): Promise<void> => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-card border-r border-border shrink-0',
        'transition-[width] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
        collapsed ? 'w-16' : 'w-60'
      )}
      aria-label="Seitennavigation"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-border shrink-0">
        {!collapsed && (
          <span className="text-xl font-semibold tracking-[-0.03em] text-primary truncate">
            Gravio
          </span>
        )}
        {collapsed && (
          <span className="text-xl font-semibold tracking-[-0.03em] text-primary mx-auto">
            G
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium',
                'transition-colors duration-150 ease-out',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={cn('h-5 w-5 shrink-0', isActive ? 'text-accent' : '')}
                strokeWidth={isActive ? 2 : 1.5}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-border p-2 space-y-1">
        {!collapsed && user?.email && (
          <p className="px-3 py-1 text-xs text-muted-foreground truncate">
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className={cn(
            'w-full text-muted-foreground hover:text-foreground',
            collapsed ? 'justify-center px-2' : 'justify-start gap-3'
          )}
          title={collapsed ? 'Abmelden' : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Abmelden</span>}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'w-full text-muted-foreground hover:text-foreground',
            collapsed ? 'justify-center px-2' : 'justify-start gap-3'
          )}
          aria-label={collapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span>Einklappen</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}
