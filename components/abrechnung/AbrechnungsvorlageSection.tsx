'use client'

import { useRef } from 'react'
import { Upload, Trash2, CheckCircle, Loader2, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAbrechnungsvorlagen, useUploadVorlage, useDeleteVorlage } from '@/hooks/use-abrechnungsvorlagen'
import type { Abrechnungsvorlage } from '@/types/lv'

export function AbrechnungsvorlageSection(): React.JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: vorlagen, isLoading } = useAbrechnungsvorlagen()
  const uploadVorlage = useUploadVorlage()
  const deleteVorlage = useDeleteVorlage()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', file.name.replace(/\.[^.]+$/, ''))
    uploadVorlage.mutate(formData)
    // Reset input so dieselbe Datei nochmal gewählt werden kann
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Abrechnungsvorlage</h3>
        <Button
          size="sm"
          variant="outline"
          className="h-10"
          onClick={() => fileRef.current?.click()}
          disabled={uploadVorlage.isPending}
        >
          {uploadVorlage.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Analysiere…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-1" />
              Hochladen
            </>
          )}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {isLoading && (
        <div className="h-12 rounded bg-muted animate-pulse" />
      )}

      {!isLoading && (!vorlagen || vorlagen.length === 0) && (
        <p className="text-xs text-muted-foreground py-2">
          Noch keine Vorlage hochgeladen. Der Export verwendet dann ein Standard-Layout.
        </p>
      )}

      {!isLoading && vorlagen && vorlagen.length > 0 && (
        <ul className="space-y-2">
          {vorlagen.map((v: Abrechnungsvorlage) => (
            <li
              key={v.id}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 min-w-0 truncate">{v.name}</span>
              {v.analysiert ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-green-500" aria-label="Analysiert" />
              ) : (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="Wird analysiert…" />
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() => deleteVorlage.mutate(v.id)}
                disabled={deleteVorlage.isPending}
                aria-label="Vorlage löschen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
