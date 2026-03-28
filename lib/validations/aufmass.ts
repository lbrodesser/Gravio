// lib/validations/aufmass.ts
import { z } from 'zod'
import { EinheitSchema } from './element-template'

export const AufmassPositionWertSchema = z.object({
  name: z.string().min(1),
  einheit: EinheitSchema,
  wert: z.preprocess(
    (v) =>
      v === '' || v === undefined || v === null || (typeof v === 'number' && isNaN(v))
        ? null
        : Number(v),
    z.number().nullable()
  ),
})

export const AufmassFormSchema = z.object({
  element_template_id: z.string().uuid('Bitte Element auswählen'),
  element_name: z.string().min(1),
  positionen_werte: z.array(AufmassPositionWertSchema),
  notiz: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(500).nullable().optional()
  ),
})

export type AufmassFormData = z.infer<typeof AufmassFormSchema>
