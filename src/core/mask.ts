const sensitiveKeyPattern = /(_TOKEN|_KEY|_SECRET|_PASSWORD)$/i

export function isSensitiveKey(key: string): boolean {
  return sensitiveKeyPattern.test(key)
}

export function maskValue(key: string, value: string): string {
  if (!isSensitiveKey(key)) {
    return value
  }

  if (value.length <= 8) {
    return '*'.repeat(value.length)
  }

  return `${value.slice(0, 9)}********`
}
