import { z } from 'zod'

const envKeySchema = z.string().regex(/^[A-Z0-9_]+$/)

export const envMapSchema = z.record(envKeySchema, z.string())

export const presetSchema = z.object({
  name: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  env: envMapSchema,
})

const historyBaseSchema = z.object({
  timestamp: z.string().datetime({ offset: true }),
  backup: envMapSchema,
  targetType: z.enum(['settings', 'preset']),
  targetName: z.string(),
})

export const historySchema = z.discriminatedUnion('action', [
  historyBaseSchema.extend({
    action: z.literal('init'),
    movedKeys: z.array(envKeySchema),
  }),
  historyBaseSchema.extend({
    action: z.literal('restore'),
  }),
])

export const configSchema = z.object({
  defaultPreset: z.string().optional(),
})

export type EnvMap = z.infer<typeof envMapSchema>
export type Preset = z.infer<typeof presetSchema>
export type HistoryRecord = z.infer<typeof historySchema>
export type Config = z.infer<typeof configSchema>
