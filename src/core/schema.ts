import { z } from 'zod'

const envKeySchema = z.string().regex(/^[A-Z0-9_]+$/)

export const envMapSchema = z.record(envKeySchema, z.string())

export const presetSchema = z.object({
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  env: envMapSchema,
})

export const historySchema = z.object({
  action: z.enum(['init', 'restore']),
  targetType: z.enum(['settings', 'preset']),
})

export const configSchema = z.object({
  defaultPreset: z.string().optional(),
})

export type EnvMap = z.infer<typeof envMapSchema>
export type Preset = z.infer<typeof presetSchema>
export type HistoryRecord = z.infer<typeof historySchema>
export type Config = z.infer<typeof configSchema>
