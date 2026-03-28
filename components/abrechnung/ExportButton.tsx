'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'

interface Props {
  abrechnungId: string
  label?: string
}

export function ExportButton({ abrechnungId, label = 'Export' }: Props): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false)

  async function handleExport(e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    setIsLoading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Nicht angemeldet')
        return
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export-excel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ abrechnung_id: abrechnungId }),
        }
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unbekannter Fehler' }))
        toast.error((err as { message?: string }).message ?? 'Export fehlgeschlagen')
        return
      }

      const { download_url } = await res.json() as { download_url: string }
      window.open(download_url, '_blank')
    } catch {
      toast.error('Export fehlgeschlagen')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-10 shrink-0"
      onClick={handleExport}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-1" />
      )}
      {label}
    </Button>
  )
}
