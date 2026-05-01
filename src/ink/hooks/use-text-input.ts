import { useState } from 'react'
import type { Key } from 'ink'

export type TextInputState = {
  value: string
  cursorPos: number
}

export type SetTextInputState = (value: string, cursorPos: number) => void

export function handleKey(
  state: TextInputState,
  input: string,
  key: Key,
  setState: SetTextInputState,
): boolean {
  const { value, cursorPos } = state

  if (key.leftArrow) {
    if (cursorPos > 0) setState(value, cursorPos - 1)
    return true
  }

  if (key.rightArrow) {
    if (cursorPos < value.length) setState(value, cursorPos + 1)
    return true
  }

  if (key.home) {
    setState(value, 0)
    return true
  }

  if (key.end) {
    setState(value, value.length)
    return true
  }

  if (key.ctrl && input === 'a') {
    setState(value, 0)
    return true
  }

  if (key.ctrl && input === 'e') {
    setState(value, value.length)
    return true
  }

  if (key.ctrl && input === 'u') {
    setState(value.slice(cursorPos), 0)
    return true
  }

  if (key.ctrl && input === 'k') {
    setState(value.slice(0, cursorPos), cursorPos)
    return true
  }

  if ((key.ctrl && (key.backspace || key.delete)) || (key.meta && (key.backspace || key.delete))) {
    if (cursorPos > 0) {
      setState(value.slice(cursorPos), 0)
    }
    return true
  }

  if (key.backspace || key.delete) {
    if (cursorPos > 0) {
      setState(value.slice(0, cursorPos - 1) + value.slice(cursorPos), cursorPos - 1)
    }
    return true
  }

  if (input && !key.ctrl && !key.meta) {
    setState(value.slice(0, cursorPos) + input + value.slice(cursorPos), cursorPos + 1)
    return true
  }

  return false
}

export function useTextInput() {
  const [value, setValue] = useState('')
  const [cursorPos, setCursorPos] = useState(0)

  const setState: SetTextInputState = (newValue, newCursor) => {
    setValue(newValue)
    setCursorPos(newCursor)
  }

  const onKey = (input: string, key: Key): boolean => {
    return handleKey({ value, cursorPos }, input, key, setState)
  }

  const reset = (newValue = '') => {
    setValue(newValue)
    setCursorPos(newValue.length)
  }

  return { value, cursorPos, handleKey: onKey, setValue, reset }
}
