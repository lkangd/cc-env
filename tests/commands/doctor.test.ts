import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runDoctorCommand } from '../../src/commands/doctor.js'

const tempRoots: string[] = []

async function createTempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'cc-env-doctor-'))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('runDoctorCommand', () => {
  it('outputs JSON with all checks when --json is passed', async () => {
    const root = await createTempRoot()
    const cwd = join(root, 'project')
    await mkdir(join(cwd, '.cc-env'), { recursive: true })
    await writeFile(join(cwd, '.cc-env', 'env.json'), '{}')

    const chunks: string[] = []
    const stdout = { write: vi.fn((s: string) => { chunks.push(s) }) }

    await runDoctorCommand({ cwd, json: true, stdout })

    const output = JSON.parse(chunks.join(''))
    expect(Array.isArray(output)).toBe(true)
    expect(output.every((c: unknown) => typeof c === 'object' && c !== null && 'label' in c && 'ok' in c)).toBe(true)
  })

  it('reports project env as failing when .cc-env/env.json is missing', async () => {
    const root = await createTempRoot()
    const cwd = join(root, 'project')
    await mkdir(cwd, { recursive: true })

    const chunks: string[] = []
    const stdout = { write: vi.fn((s: string) => { chunks.push(s) }) }

    await runDoctorCommand({ cwd, json: true, stdout })

    const output: Array<{ label: string; ok: boolean }> = JSON.parse(chunks.join(''))
    const projectCheck = output.find((c) => c.label.includes('Project env'))
    expect(projectCheck?.ok).toBe(false)
  })

  it('reports project env as passing when .cc-env/env.json exists', async () => {
    const root = await createTempRoot()
    const cwd = join(root, 'project')
    await mkdir(join(cwd, '.cc-env'), { recursive: true })
    await writeFile(join(cwd, '.cc-env', 'env.json'), '{}')

    const chunks: string[] = []
    const stdout = { write: vi.fn((s: string) => { chunks.push(s) }) }

    await runDoctorCommand({ cwd, json: true, stdout })

    const output: Array<{ label: string; ok: boolean }> = JSON.parse(chunks.join(''))
    const projectCheck = output.find((c) => c.label.includes('Project env'))
    expect(projectCheck?.ok).toBe(true)
  })

  it('writes human-readable output when json is false', async () => {
    const root = await createTempRoot()
    const cwd = join(root, 'project')
    await mkdir(cwd, { recursive: true })

    const chunks: string[] = []
    const stdout = { write: vi.fn((s: string) => { chunks.push(s) }) }

    await runDoctorCommand({ cwd, json: false, stdout })

    const output = chunks.join('')
    expect(output).toContain('Global root')
    expect(output).toContain('Claude executable')
    expect(output).toContain('Project env')
  })

  it('sets exitCode to 1 and reports singular failed check count', async () => {
    const root = await createTempRoot()
    const cwd = join(root, 'project')
    await mkdir(cwd, { recursive: true })

    await mkdir(join(root, '.cc-env'), { recursive: true })
    await mkdir(join(root, '.cc-env', 'presets'), { recursive: true })

    const originalHome = process.env.HOME
    process.env.HOME = root

    const originalExitCode = process.exitCode
    const chunks: string[] = []
    const stdout = { write: vi.fn((s: string) => { chunks.push(s) }) }

    await runDoctorCommand({ cwd, json: false, stdout })

    const output = chunks.join('')
    expect(output).toContain('1 check failed')
    expect(process.exitCode).toBe(1)

    process.exitCode = originalExitCode
    process.env.HOME = originalHome
  })


})
