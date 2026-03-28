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
  getAbrechnungFuerAufmass,
  getAbrechnungenFuerBaustelle,
  createAbrechnungFuerAufmass,
  updateAbrechnungPosition,
  deleteAbrechnung,
} from '@/actions/abrechnungen'
import type { AbrechnungMitPositionen } from '@/types/lv'
import type { AufmassPositionWert } from '@/types'

// ─── Input Types ──────────────────────────────────────────────────────────────

interface LvPositionInput {
  id: string
  kurztext: string
  einheit: string
  einheitspreis: number
  faktor: number
}

interface CreateAbrechnungInput {
  aufmassId: string
  baustelleId: string
  aufmassName: string
  positionenWerte: AufmassPositionWert[]
  lvPositionen: LvPositionInput[]
}

interface UpdateAbrechnungPositionInput {
  id: string
  menge: number
  aufmassId: string
}

interface DeleteAbrechnungInput {
  id: string
  baustelleId: string
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAbrechnungFuerAufmass(
  aufmassId: string | null
): UseQueryResult<AbrechnungMitPositionen | null, Error> {
  return useQuery({
    queryKey: ['abrechnung-aufmass', aufmassId] as const,
    enabled: !!aufmassId,
    queryFn: async (): Promise<AbrechnungMitPositionen | null> => {
      if (!aufmassId) return null
      const result = await getAbrechnungFuerAufmass(aufmassId)
      if (result.error) throw new Error(result.error)
      return result.data
    },
  })
}

export function useAbrechnungenFuerBaustelle(
  baustelleId: string | null
): UseQueryResult<AbrechnungMitPositionen[], Error> {
  return useQuery({
    queryKey: ['abrechnungen-baustelle', baustelleId] as const,
    enabled: !!baustelleId,
    queryFn: async (): Promise<AbrechnungMitPositionen[]> => {
      if (!baustelleId) return []
      const result = await getAbrechnungenFuerBaustelle(baustelleId)
      if (result.error) throw new Error(result.error)
      return result.data ?? []
    },
  })
}

export function useCreateAbrechnung(): UseMutationResult<
  { data: { id: string } | null; error: string | null },
  Error,
  CreateAbrechnungInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateAbrechnungInput) =>
      createAbrechnungFuerAufmass(input),
    onSuccess: (result, variables) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['abrechnung-aufmass', variables.aufmassId],
      })
      queryClient.invalidateQueries({
        queryKey: ['abrechnungen-baustelle', variables.baustelleId],
      })
      toast.success('Abrechnung erstellt')
    },
    onError: () => toast.error('Fehler beim Erstellen der Abrechnung'),
  })
}

export function useUpdateAbrechnungPosition(): UseMutationResult<
  { error: string | null },
  Error,
  UpdateAbrechnungPositionInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, menge }: UpdateAbrechnungPositionInput) =>
      updateAbrechnungPosition(id, menge),
    onSuccess: (result, variables) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['abrechnung-aufmass', variables.aufmassId],
      })
    },
    onError: () => toast.error('Aktualisierung fehlgeschlagen'),
  })
}

export function useDeleteAbrechnung(): UseMutationResult<
  { error: string | null },
  Error,
  DeleteAbrechnungInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, baustelleId }: DeleteAbrechnungInput) =>
      deleteAbrechnung(id, baustelleId),
    onSuccess: (result, variables) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['abrechnungen-baustelle', variables.baustelleId],
      })
      toast.success('Abrechnung gelöscht')
    },
    onError: () => toast.error('Löschen fehlgeschlagen'),
  })
}
