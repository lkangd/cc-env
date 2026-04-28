import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { createLogger } from '../../src/core/logger.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('createLogger', () => {
  it('creates parent directory and writes logs to app.log', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cc-env-logger-'))
    roots.push(root)

    const logger = await createLogger(root)
    logger.info('hello')
    await new Promise((resolve) => setTimeout(resolve, 20))

    const content = await readFile(join(root, 'logs', 'app.log'), 'utf8')
    expect(content).toContain('hello')
  })
})
