import { z } from 'zod'

const envKeySchema = z.string().regex(/^[A-Z0-9_]+$/)

export const envMapSchema = z.record(
  envKeySchema,
  z.unknown()
    .refine((value) => value === null || typeof value !== 'object')
    .transform((value) => String(value)),
)

export const presetSchema = z.object({
  name: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  env: envMapSchema,
})

const shellWriteSchema = z.object({
  shell: z.enum(['zsh', 'bash', 'fish']),
  filePath: z.string(),
  env: envMapSchema,
})

const initHistorySchema = z.object({
  timestamp: z.string().datetime({ offset: true }),
  action: z.literal('init'),
  migratedKeys: z.array(envKeySchema),
  settingsBackup: envMapSchema,
  settingsLocalBackup: envMapSchema,
  shellWrites: z.array(shellWriteSchema),
})

const restoreHistorySchema = z.object({
  timestamp: z.string().datetime({ offset: true }),
  action: z.literal('restore'),
  backup: envMapSchema,
  targetType: z.enum(['settings', 'preset']),
  targetName: z.string(),
})

export const historySchema = z.discriminatedUnion('action', [
  initHistorySchema,
  restoreHistorySchema,
])

export const configSchema = z.object({
  defaultPreset: z.string().optional(),
})

export type EnvMap = z.infer<typeof envMapSchema>
export type Preset = z.infer<typeof presetSchema>
export type InitHistoryRecord = z.infer<typeof initHistorySchema>
export type HistoryRecord = z.infer<typeof historySchema>
export type Config = z.infer<typeof configSchema>
