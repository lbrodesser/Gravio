'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import {
  ElementTemplateFormSchema,
  type ElementTemplateFormData,
} from '@/lib/validations/element-template'

export async function createElementTemplate(
  data: ElementTemplateFormData
): Promise<{ error: string | null; id?: string }> {
  const parsed = ElementTemplateFormSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { data: inserted, error } = await supabase
    .from('element_templates')
    .insert({ ...parsed.data, created_by: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/mobile/elemente')
  revalidatePath('/desktop/elemente')
  return { error: null, id: (inserted as { id: string }).id }
}

export async function updateElementTemplate(
  id: string,
  data: ElementTemplateFormData
): Promise<{ error: string | null }> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'Ungültige ID' }

  const parsed = ElementTemplateFormSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { data: rows, error } = await supabase
    .from('element_templates')
    .update(parsed.data)
    .eq('id', idParsed.data)
    .select('id')

  if (error) return { error: error.message }
  if (!rows?.length) return { error: 'Element nicht gefunden oder keine Berechtigung' }

  revalidatePath('/mobile/elemente')
  revalidatePath('/desktop/elemente')
  return { error: null }
}

export async function deleteElementTemplate(
  id: string
): Promise<{ error: string | null }> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'Ungültige ID' }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { data: rows, error } = await supabase
    .from('element_templates')
    .delete()
    .eq('id', idParsed.data)
    .select('id')

  if (error) return { error: error.message }
  if (!rows?.length) return { error: 'Element nicht gefunden oder keine Berechtigung' }

  revalidatePath('/mobile/elemente')
  revalidatePath('/desktop/elemente')
  return { error: null }
}
