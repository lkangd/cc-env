import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

describe('cc-env CLI help', () => {
  it('shows the top-level commands in --help output', async () => {
    const { stdout } = await execa('npx', ['tsx', 'src/cli.ts', '--help'], {
      cwd: '/Users/liangkangda/Fe-project/code/cc-env/.worktrees/cc-env-v1',
    })

    expect(stdout).toContain('run')
    expect(stdout).toContain('init')
    expect(stdout).toContain('restore')
    expect(stdout).toContain('preset')
    expect(stdout).toContain('debug')
  })
})
