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
  getLvGruppen,
  getLvPositionen,
  importLv,
  deleteLvGruppe,
  updateLvPosition,
} from '@/actions/lv'
import type { LvGruppe, LvPosition } from '@/types/lv'
import type { LvImportData, LvPositionFormData } from '@/lib/validations/lv'

const LV_GRUPPEN_KEY = ['lv-gruppen'] as const
const LV_POSITIONEN_KEY = (gruppeId: string) => ['lv-positionen', gruppeId] as const

export function useLvGruppen(): UseQueryResult<LvGruppe[], Error> {
  return useQuery({
    queryKey: LV_GRUPPEN_KEY,
    queryFn: async (): Promise<LvGruppe[]> => {
      const result = await getLvGruppen()
      if (result.error) throw new Error(result.error)
      return result.data ?? []
    },
  })
}

export function useLvPositionen(
  gruppeId: string | null
): UseQueryResult<LvPosition[], Error> {
  return useQuery({
    queryKey: LV_POSITIONEN_KEY(gruppeId ?? ''),
    enabled: !!gruppeId,
    queryFn: async (): Promise<LvPosition[]> => {
      if (!gruppeId) return []
      const result = await getLvPositionen(gruppeId)
      if (result.error) throw new Error(result.error)
      return result.data ?? []
    },
  })
}

export function useImportLv(): UseMutationResult<
  { error: string | null },
  Error,
  LvImportData
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: LvImportData) => importLv(data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: LV_GRUPPEN_KEY })
      toast.success('Leistungsverzeichnis importiert')
    },
    onError: () => {
      toast.error('Import fehlgeschlagen')
    },
  })
}

export function useDeleteLvGruppe(): UseMutationResult<
  { error: string | null },
  Error,
  string
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteLvGruppe(id),
    onSuccess: (result, id) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.setQueryData<LvGruppe[]>(LV_GRUPPEN_KEY, (previous) =>
        (previous ?? []).filter((g) => g.id !== id)
      )
      toast.success('Leistungsverzeichnis gelöscht')
    },
    onError: () => {
      toast.error('Löschen fehlgeschlagen')
    },
  })
}

export function useUpdateLvPosition(): UseMutationResult<
  { error: string | null },
  Error,
  { id: string; data: LvPositionFormData }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: LvPositionFormData }) =>
      updateLvPosition(id, data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['lv-positionen'] })
      toast.success('Position aktualisiert')
    },
    onError: () => {
      toast.error('Aktualisierung fehlgeschlagen')
    },
  })
}
