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

  it('rejects with CliError when process exits with non-zero code', async () => {
    const child = new EventEmitter()
    spawnMock.mockReturnValue(child)

    const { spawnCommand } = await import('../../src/core/spawn.js')
    const promise = spawnCommand('node', ['script.js'], process.env)

    child.emit('close', 9, null)

    await expect(promise).rejects.toMatchObject({
      message: 'Command exited with code 9',
      exitCode: 9,
    })
  })

  it('resolves when process exits with code 0', async () => {
    const child = new EventEmitter()
    spawnMock.mockReturnValue(child)

    const { spawnCommand } = await import('../../src/core/spawn.js')
    const promise = spawnCommand('node', ['script.js'], process.env)

    child.emit('close', 0, null)

    await expect(promise).resolves.toBeUndefined()
  })
})
