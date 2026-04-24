import { mkdir, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
}

export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const parentDir = dirname(filePath)
  const tempFilePath = join(
    parentDir,
    `.${basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  )

  await ensureParentDir(filePath)
  await writeFile(tempFilePath, content, 'utf8')
  await rename(tempFilePath, filePath)
}
