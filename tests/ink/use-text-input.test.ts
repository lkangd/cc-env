import { describe, expect, it } from 'vitest'

import { handleKey } from '../../src/ink/hooks/use-text-input.js'
import type { Key } from 'ink'

function key(overrides: Partial<Key> = {}): Key {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    home: false,
    end: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    super: false,
    hyper: false,
    capsLock: false,
    numLock: false,
    ...overrides,
  }
}

describe('handleKey', () => {
  it('inserts character at cursor position', () => {
    let value = ''
    let cursorPos = 0
    const result = handleKey(
      { value, cursorPos },
      'a',
      key(),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(result).toBe(true)
    expect(value).toBe('a')
    expect(cursorPos).toBe(1)
  })

  it('inserts character in the middle', () => {
    let value = 'acd'
    let cursorPos = 1
    handleKey(
      { value, cursorPos },
      'b',
      key(),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(value).toBe('abcd')
    expect(cursorPos).toBe(2)
  })

  it('moves cursor left', () => {
    let value = 'abc'
    let cursorPos = 3
    handleKey(
      { value, cursorPos },
      '',
      key({ leftArrow: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(value).toBe('abc')
    expect(cursorPos).toBe(2)
  })

  it('does not move cursor left past start', () => {
    let value = 'abc'
    let cursorPos = 0
    handleKey(
      { value, cursorPos },
      '',
      key({ leftArrow: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(cursorPos).toBe(0)
  })

  it('moves cursor right', () => {
    let value = 'abc'
    let cursorPos = 1
    handleKey(
      { value, cursorPos },
      '',
      key({ rightArrow: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(cursorPos).toBe(2)
  })

  it('does not move cursor right past end', () => {
    let value = 'abc'
    let cursorPos = 3
    handleKey(
      { value, cursorPos },
      '',
      key({ rightArrow: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(cursorPos).toBe(3)
  })

  it('moves cursor to start on Home', () => {
    let value = 'abc'
    let cursorPos = 2
    handleKey(
      { value, cursorPos },
      '',
      key({ home: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(cursorPos).toBe(0)
  })

  it('moves cursor to end on End', () => {
    let value = 'abc'
    let cursorPos = 0
    handleKey(
      { value, cursorPos },
      '',
      key({ end: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(cursorPos).toBe(3)
  })

  it('moves cursor to start on Ctrl+A', () => {
    let value = 'abc'
    let cursorPos = 2
    handleKey(
      { value, cursorPos },
      'a',
      key({ ctrl: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(cursorPos).toBe(0)
  })

  it('moves cursor to end on Ctrl+E', () => {
    let value = 'abc'
    let cursorPos = 0
    handleKey(
      { value, cursorPos },
      'e',
      key({ ctrl: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(cursorPos).toBe(3)
  })

  it('deletes all before cursor on Ctrl+U', () => {
    let value = 'abcdef'
    let cursorPos = 3
    handleKey(
      { value, cursorPos },
      'u',
      key({ ctrl: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(value).toBe('def')
    expect(cursorPos).toBe(0)
  })

  it('deletes all after cursor on Ctrl+K', () => {
    let value = 'abcdef'
    let cursorPos = 3
    handleKey(
      { value, cursorPos },
      'k',
      key({ ctrl: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(value).toBe('abc')
    expect(cursorPos).toBe(3)
  })

  it('deletes char before cursor on Backspace', () => {
    let value = 'abc'
    let cursorPos = 2
    handleKey(
      { value, cursorPos },
      '',
      key({ backspace: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(value).toBe('ac')
    expect(cursorPos).toBe(1)
  })

  it('does nothing on Backspace at start', () => {
    let value = 'abc'
    let cursorPos = 0
    handleKey(
      { value, cursorPos },
      '',
      key({ backspace: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(value).toBe('abc')
    expect(cursorPos).toBe(0)
  })

  it('deletes all before cursor on Ctrl+Backspace', () => {
    let value = 'abcdef'
    let cursorPos = 3
    handleKey(
      { value, cursorPos },
      '',
      key({ ctrl: true, backspace: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(value).toBe('def')
    expect(cursorPos).toBe(0)
  })

  it('deletes all before cursor on Meta+Backspace', () => {
    let value = 'abcdef'
    let cursorPos = 3
    handleKey(
      { value, cursorPos },
      '',
      key({ meta: true, backspace: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(value).toBe('def')
    expect(cursorPos).toBe(0)
  })

  it('does nothing on Meta+Backspace at start', () => {
    let value = 'abc'
    let cursorPos = 0
    handleKey(
      { value, cursorPos },
      '',
      key({ meta: true, backspace: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(value).toBe('abc')
    expect(cursorPos).toBe(0)
  })

  it('deletes char before cursor on Delete', () => {
    let value = 'abc'
    let cursorPos = 2
    handleKey(
      { value, cursorPos },
      '',
      key({ delete: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(value).toBe('ac')
    expect(cursorPos).toBe(1)
  })

  it('does nothing on Delete at start', () => {
    let value = 'abc'
    let cursorPos = 0
    handleKey(
      { value, cursorPos },
      '',
      key({ delete: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(value).toBe('abc')
    expect(cursorPos).toBe(0)
  })

  it('returns false for unhandled Return key', () => {
    let value = 'abc'
    let cursorPos = 3
    const result = handleKey(
      { value, cursorPos },
      '',
      key({ return: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(result).toBe(false)
    expect(value).toBe('abc')
    expect(cursorPos).toBe(3)
  })

  it('returns false for unhandled Escape key', () => {
    let value = 'abc'
    let cursorPos = 3
    const result = handleKey(
      { value, cursorPos },
      '',
      key({ escape: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(result).toBe(false)
  })

  it('inserts q as regular character', () => {
    let value = 'abc'
    let cursorPos = 3
    const result = handleKey(
      { value, cursorPos },
      'q',
      key(),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(result).toBe(true)
    expect(value).toBe('abcq')
    expect(cursorPos).toBe(4)
  })

  it('returns false for ctrl+unknown key', () => {
    let value = 'abc'
    let cursorPos = 3
    const result = handleKey(
      { value, cursorPos },
      'x',
      key({ ctrl: true }),
      (v, c) => { value = v; cursorPos = c },
    )
    expect(result).toBe(false)
    expect(value).toBe('abc')
  })
})
