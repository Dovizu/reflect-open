import { describe, expect, it } from 'vitest'
import { listRegisteredBindings, registerKeymap } from './keymap.ts'

describe('keymap registry', () => {
  it('rejects an app binding that collides with an editor binding', () => {
    expect(() => registerKeymap('app', { 'Mod-b': 'collides' })).toThrow(/duplicate keybinding/)
    expect(listRegisteredBindings().get('Mod-b')).toBe('editor') // untouched
  })

  it('holds meowdown editor bindings editor-scope', () => {
    const bindings = listRegisteredBindings()
    expect(bindings.get('Mod-b')).toBe('editor')
    expect(bindings.get('Mod-i')).toBe('editor')
    expect(bindings.get('Mod-Alt-1')).toBe('editor')
  })
})
