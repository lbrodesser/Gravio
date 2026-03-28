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
import {
  createBaustelle,
  updateBaustelle,
  deleteBaustelle,
} from '@/actions/baustellen'
import type { Baustelle } from '@/types'
import type { BaustelleFormData } from '@/lib/validations/baustelle'

const QUERY_KEY = ['baustellen'] as const

export function useBaustellen(): UseQueryResult<Baustelle[], Error> {
  const supabase = createBrowserClient()

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<Baustelle[]> => {
      const { data, error } = await supabase
        .from('baustellen')
        .select('id, user_id, name, adresse, created_at, updated_at')
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)
      return data as Baustelle[]
    },
  })
}

export function useCreateBaustelle(): UseMutationResult<
  { error: string | null },
  Error,
  BaustelleFormData
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BaustelleFormData) => createBaustelle(data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Baustelle erstellt')
    },
  })
}

export function useUpdateBaustelle(): UseMutationResult<
  { error: string | null },
  Error,
  { id: string; data: BaustelleFormData }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BaustelleFormData }) =>
      updateBaustelle(id, data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Baustelle gespeichert')
    },
  })
}

export function useDeleteBaustelle(): UseMutationResult<
  { error: string | null },
  Error,
  string,
  { previous: Baustelle[] }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteBaustelle(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous =
        queryClient.getQueryData<Baustelle[]>(QUERY_KEY) ?? []
      queryClient.setQueryData<Baustelle[]>(
        QUERY_KEY,
        previous.filter((b) => b.id !== id)
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous)
      }
      toast.error('Löschen fehlgeschlagen')
    },
    onSuccess: (result, _id, context) => {
      if (result.error) {
        if (context?.previous) {
          queryClient.setQueryData(QUERY_KEY, context.previous)
        }
        toast.error(result.error)
      } else {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY })
        toast.success('Baustelle gelöscht')
      }
    },
  })
}
