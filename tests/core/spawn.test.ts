import { EventEmitter } from 'node:events'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { CliError } from '../../src/core/errors.js'

const spawnMock = vi.fn()

vi.mock('cross-spawn', () => ({
  default: spawnMock,
}))

describe('spawnCommand', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('rejects with a CliError when the process closes due to a signal', async () => {
    const child = new EventEmitter()
    spawnMock.mockReturnValue(child)

    const { spawnCommand } = await import('../../src/core/spawn.js')
    const promise = spawnCommand('node', ['script.js'], process.env)

    child.emit('close', null, 'SIGTERM')

    await expect(promise).rejects.toEqual(
      new CliError('Command terminated by signal SIGTERM'),
    )
  })

  it('rejects with a human-readable CliError when the process closes without an exit code or signal', async () => {
    const child = new EventEmitter()
    spawnMock.mockReturnValue(child)

    const { spawnCommand } = await import('../../src/core/spawn.js')
    const promise = spawnCommand('node', ['script.js'], process.env)

    child.emit('close', null, null)

    await expect(promise).rejects.toMatchObject({
      message: 'Command terminated without an exit code',
      exitCode: 1,
    })
  })
})
