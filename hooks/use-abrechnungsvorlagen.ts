'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getAbrechnungsvorlagen,
  uploadUndAnalysiereVorlage,
  deleteAbrechnungsvorlage,
} from '@/actions/abrechnungsvorlagen'
import type { Abrechnungsvorlage } from '@/types/lv'

export function useAbrechnungsvorlagen(): UseQueryResult<Abrechnungsvorlage[], Error> {
  return useQuery({
    queryKey: ['abrechnungsvorlagen'] as const,
    queryFn: async (): Promise<Abrechnungsvorlage[]> => {
      const result = await getAbrechnungsvorlagen()
      if (result.error) throw new Error(result.error)
      return result.data ?? []
    },
  })
}

export function useUploadVorlage(): UseMutationResult<
  { data: Abrechnungsvorlage | null; error: string | null },
  Error,
  FormData
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) => uploadUndAnalysiereVorlage(formData),
    onSuccess: (result) => {
      if (result.error) {
        // Partieller Erfolg: hochgeladen aber Analyse fehlgeschlagen
        toast.warning(result.error)
      } else {
        toast.success('Vorlage hochgeladen und analysiert')
      }
      queryClient.invalidateQueries({ queryKey: ['abrechnungsvorlagen'] })
    },
    onError: () => toast.error('Upload fehlgeschlagen'),
  })
}

export function useDeleteVorlage(): UseMutationResult<
  { error: string | null },
  Error,
  string
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAbrechnungsvorlage(id),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['abrechnungsvorlagen'] })
      toast.success('Vorlage gelöscht')
    },
    onError: () => toast.error('Löschen fehlgeschlagen'),
  })
}
