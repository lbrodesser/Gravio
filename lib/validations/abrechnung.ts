// lib/validations/abrechnung.ts
import { z } from 'zod'

const nullablePositiveNumber = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
  z.number().min(0).nullable()
)

export const AbrechnungPositionFormSchema = z.object({
  positionsname: z.string().min(1),
  einheit: z.string().min(1),
  menge: nullablePositiveNumber,
  einheitspreis: nullablePositiveNumber,
  faktor: z.preprocess(
    (v) => (v === '' || v === undefined ? 1 : Number(v)),
    z.number().min(0).default(1)
  ),
  lv_position_id: z.string().uuid().nullable().optional(),
})

export type AbrechnungPositionFormData = z.infer<typeof AbrechnungPositionFormSchema>
