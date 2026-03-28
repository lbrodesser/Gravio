'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'
import { createAufmass, deleteAufmass } from '@/actions/aufmasse'
import type { Aufmass } from '@/types'
import type { AufmassFormData } from '@/lib/validations/aufmass'

const aufmasseQueryKey = (baustelleId: string) =>
  ['aufmasse', baustelleId] as const

export function useAufmasse(
  baustelleId: string
): UseQueryResult<Aufmass[], Error> {
  const supabase = createBrowserClient()

  return useQuery({
    queryKey: aufmasseQueryKey(baustelleId),
    queryFn: async (): Promise<Aufmass[]> => {
      const { data, error } = await supabase
        .from('aufmasse')
        .select('*')
        .eq('baustelle_id', baustelleId)
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)
      return data as Aufmass[]
    },
    enabled: !!baustelleId,
  })
}

export function useCreateAufmass(): UseMutationResult<
  { error: string | null },
  Error,
  { baustelleId: string; data: AufmassFormData }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      baustelleId,
      data,
    }: {
      baustelleId: string
      data: AufmassFormData
    }) => createAufmass(baustelleId, data),
    onSuccess: (result, { baustelleId }) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({
        queryKey: aufmasseQueryKey(baustelleId),
      })
      toast.success('Aufmaß erfasst')
    },
  })
}

export function useDeleteAufmass(): UseMutationResult<
  { error: string | null },
  Error,
  { id: string; baustelleId: string },
  { previous: Aufmass[] }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, baustelleId }: { id: string; baustelleId: string }) =>
      deleteAufmass(id, baustelleId),
    onMutate: async ({ id, baustelleId }) => {
      const key = aufmasseQueryKey(baustelleId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Aufmass[]>(key) ?? []
      queryClient.setQueryData<Aufmass[]>(
        key,
        previous.filter((a) => a.id !== id)
      )
      return { previous }
    },
    onError: (_err, { baustelleId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(aufmasseQueryKey(baustelleId), context.previous)
      }
      toast.error('Löschen fehlgeschlagen')
    },
    onSuccess: (result, { baustelleId }, context) => {
      if (result.error) {
        if (context?.previous) {
          queryClient.setQueryData(
            aufmasseQueryKey(baustelleId),
            context.previous
          )
        }
        toast.error(result.error)
      } else {
        queryClient.invalidateQueries({
          queryKey: aufmasseQueryKey(baustelleId),
        })
        toast.success('Aufmaß gelöscht')
      }
    },
  })
}
