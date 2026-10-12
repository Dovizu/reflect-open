import { describe, expect, it } from 'vitest'
import { createTestNavigationService } from './navigation.ts'

describe('createTestNavigationService', () => {
  it('is the real service and records each navigate call', () => {
    const navigation = createTestNavigationService({ initialRoute: { kind: 'tasks' } })
    expect(navigation.getState().route).toEqual({ kind: 'tasks' })

    navigation.navigate({ kind: 'note', path: 'notes/a.md' }, { focusEditor: true })
    navigation.navigate({ kind: 'daily', date: '2026-02-31' })

    expect(navigation.getState().route).toEqual({ kind: 'today' })
    expect(navigation.navigations()).toEqual([
      { route: { kind: 'note', path: 'notes/a.md' }, options: { focusEditor: true } },
      { route: { kind: 'daily', date: '2026-02-31' }, options: undefined },
    ])
  })
})
