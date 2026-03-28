// lib/validations/element-template.ts
import { z } from 'zod'

export const EinheitSchema = z.enum(['m³', 'm²', 'm', 'Stk', 't'])

export const PositionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name ist erforderlich'),
  einheit: EinheitSchema,
  menge: z.number().nullable(),
})

// Hilfsfunktion: leere Strings und NaN → null für numerische Felder
const nullableNumber = z.preprocess(
  (v) =>
    v === '' || v === undefined || v === null || (typeof v === 'number' && isNaN(v))
      ? null
      : Number(v),
  z.number().positive('Muss eine positive Zahl sein').nullable()
)

export const ElementTemplateFormSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  description: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().nullable().optional()
  ),
  laenge: nullableNumber,
  breite: nullableNumber,
  tiefe: nullableNumber,
  positionen: z.array(PositionSchema).default([]),
})

export type ElementTemplateFormData = z.infer<typeof ElementTemplateFormSchema>
