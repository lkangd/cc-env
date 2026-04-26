import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { atomicWriteFile } from '../core/fs.js'

type PresetRef = { presetName: string; source: 'global' | 'project' }

export function createProjectStateService(globalRoot: string) {
  const filePath = join(globalRoot, 'project-state.json')

  async function readAll(): Promise<Record<string, PresetRef>> {
    try {
      const content = await readFile(filePath, 'utf8')
      return JSON.parse(content) as Record<string, PresetRef>
    } catch {
      return {}
    }
  }

  return {
    async getLastPreset(cwd: string): Promise<PresetRef | undefined> {
      const state = await readAll()
      return state[cwd]
    },
    async saveLastPreset(cwd: string, ref: PresetRef): Promise<void> {
      const state = await readAll()
      state[cwd] = ref
      await atomicWriteFile(filePath, `${JSON.stringify(state, null, 2)}\n`)
    },
  }
}
