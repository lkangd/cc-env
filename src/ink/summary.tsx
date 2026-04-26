import React from 'react'
import type { ReactNode } from 'react'
import { Box, Text, render } from 'ink'

const h = React.createElement

import { maskValue } from '../core/mask.js'
import type { EnvMap } from '../core/schema.js'

export function EnvEntries({ entries, mask }: { entries: [string, string][]; mask?: boolean }) {
  if (entries.length === 0) {
    return <Text dimColor>none</Text>
  }
  return <>{entries.map(([key, value]) => (
    <Box key={key}>
      <Text color="yellow">• </Text>
      <Text color="magenta">{key}</Text>
      <Text dimColor>=</Text>
      <Text color="white">{mask ? maskValue(key, value) : value}</Text>
    </Box>
  ))}</>
}

export function EnvSummary({
  title,
  entries,
  description,
  fromFiles,
  toFiles,
  footer,
  mask,
}: {
  title: string
  entries: [string, string][]
  description?: string
  fromFiles?: string[]
  toFiles?: string[]
  footer?: ReactNode
  mask?: boolean
}) {
  return (
    <Box flexDirection="column">
      {description ? <Text dimColor>{description}</Text> : null}
      {fromFiles && fromFiles.length > 0 ? (
        <Box flexDirection="column">
          <Text dimColor>From:</Text>
          {fromFiles.map((file) => (
            <Text key={file} color="cyan">  {file}</Text>
          ))}
        </Box>
      ) : null}
      {toFiles && toFiles.length > 0 ? (
        <Box flexDirection="column">
          <Text dimColor>To:</Text>
          {toFiles.map((file) => (
            <Text key={file} color="cyan">  {file}</Text>
          ))}
        </Box>
      ) : null}
      <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="green" paddingX={1}>
        <Text bold color="green">{title}</Text>
        <EnvEntries entries={entries} {...(mask ? { mask } : {})} />
      </Box>
      {footer ?? null}
    </Box>
  )
}

export async function renderEnvSummary(props: {
  title: string
  description?: string
  env: EnvMap
  fromFiles?: string[]
  toFiles?: string[]
  footer?: ReactNode
}): Promise<void> {
  const entries: [string, string][] = Object.entries(props.env).sort(([a], [b]) => a.localeCompare(b)) as [string, string][]
  const app = render(
    h(EnvSummary, {
      title: props.title,
      entries,
      mask: true,
      ...(props.description ? { description: props.description } : {}),
      ...(props.fromFiles ? { fromFiles: props.fromFiles } : {}),
      ...(props.toFiles ? { toFiles: props.toFiles } : {}),
      ...(props.footer ? { footer: props.footer } : {}),
    }),
  )
  app.unmount()
  await app.waitUntilExit()
}
