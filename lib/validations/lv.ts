// lib/validations/lv.ts
import { z } from 'zod'

export const LvGruppeFormSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
})

export const LvPositionFormSchema = z.object({
  artikelnr: z.string().max(50).nullable().optional(),
  kurztext: z.string().min(1, 'Kurztext ist erforderlich').max(500),
  einheit: z.string().min(1, 'Einheit ist erforderlich').max(20),
  einheitspreis: z.preprocess(
    (v) => (v === '' || v === undefined ? null : Number(v)),
    z.number({ error: 'Muss eine Zahl sein' }).min(0).nullable()
  ),
  faktor: z.preprocess(
    (v) => (v === '' || v === undefined ? 1 : Number(v)),
    z.number().min(0).default(1)
  ),
})

export const LvImportRowSchema = z.object({
  artikelnr: z.string().nullable().optional(),
  kurztext: z.string().min(1),
  einheit: z.string().min(1),
  einheitspreis: z.number().min(0),
  faktor: z.number().min(0).default(1),
})

export const LvImportSchema = z.object({
  gruppenname: z.string().min(1),
  positionen: z.array(LvImportRowSchema).min(1, 'Mindestens eine Position erforderlich'),
  einheiten_faktoren: z.record(z.string(), z.number()).default({}),
})

export type LvGruppeFormData = z.infer<typeof LvGruppeFormSchema>
export type LvPositionFormData = z.infer<typeof LvPositionFormSchema>
export type LvImportData = z.infer<typeof LvImportSchema>
