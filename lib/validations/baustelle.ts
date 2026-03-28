// lib/validations/baustelle.ts
import { z } from 'zod'

export const BaustelleFormSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  adresse: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(200).nullable().optional()
  ),
})

export type BaustelleFormData = z.infer<typeof BaustelleFormSchema>
