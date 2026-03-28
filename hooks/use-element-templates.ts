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
  createElementTemplate,
  updateElementTemplate,
  deleteElementTemplate,
} from '@/actions/element-templates'
import type { ElementTemplate } from '@/types'
import type { ElementTemplateFormData } from '@/lib/validations/element-template'

const QUERY_KEY = ['element-templates'] as const

export function useElementTemplates(): UseQueryResult<ElementTemplate[], Error> {
  const supabase = createBrowserClient()

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ElementTemplate[]> => {
      const { data, error } = await supabase
        .from('element_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)
      return data as ElementTemplate[]
    },
  })
}

export function useCreateTemplate(): UseMutationResult<
  { error: string | null },
  Error,
  ElementTemplateFormData
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ElementTemplateFormData) => createElementTemplate(data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Element erstellt')
    },
  })
}

export function useUpdateTemplate(): UseMutationResult<
  { error: string | null },
  Error,
  { id: string; data: ElementTemplateFormData }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ElementTemplateFormData }) =>
      updateElementTemplate(id, data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Element gespeichert')
    },
  })
}

export function useDeleteTemplate(): UseMutationResult<
  { error: string | null },
  Error,
  string,
  { previous: ElementTemplate[] }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteElementTemplate(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous =
        queryClient.getQueryData<ElementTemplate[]>(QUERY_KEY) ?? []
      queryClient.setQueryData<ElementTemplate[]>(
        QUERY_KEY,
        previous.filter((t) => t.id !== id)
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous)
      }
      toast.error('Löschen fehlgeschlagen')
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Element gelöscht')
      }
    },
  })
}
