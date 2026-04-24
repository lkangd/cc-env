import { describe, expect, it, vi } from 'vitest'

import { toProcessEnvMap } from '../../src/core/process-env.js'
import { createPresetCreateCommand } from '../../src/commands/preset/create.js'

describe('toProcessEnvMap', () => {
  it('filters process.env-like input to string values only', () => {
    expect(
      toProcessEnvMap({
        ANTHROPIC_BASE_URL: 'https://api.openai.com',
        EMPTY: undefined,
        PORT: 3000,
        ENABLED: true,
      }),
    ).toEqual({
      ANTHROPIC_BASE_URL: 'https://api.openai.com',
    })
  })
})

describe('createPresetCreateCommand', () => {
  it('creates a preset from inline KEY=VALUE pairs', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn()

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow,
    })

    await createPreset({
      name: 'openai',
      pairs: ['ANTHROPIC_BASE_URL=https://api.openai.com'],
    })

    expect(presetService.write).toHaveBeenCalledWith('openai', {
      ANTHROPIC_BASE_URL: 'https://api.openai.com',
    })
    expect(projectEnvService.write).not.toHaveBeenCalled()
    expect(renderFlow).not.toHaveBeenCalled()
  })
})
