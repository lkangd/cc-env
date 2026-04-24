const sensitiveKeyPattern = /(_TOKEN|_KEY|_SECRET|_PASSWORD)$/

export function isSensitiveKey(key: string): boolean {
  return sensitiveKeyPattern.test(key)
}

export function maskValue(key: string, value: string): string {
  if (!isSensitiveKey(key)) {
    return value
  }

  return `${value.slice(0, 9)}********`
}
