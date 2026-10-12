import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { afterEach, describe, expect, it } from 'vitest'
import { setDefaultUpdate, type UpdateState } from '@reflect/core'
import { createTestUpdateService, type TestUpdateService } from '@reflect/core/testing'
import { UpdateProvider } from '@/providers/update-provider.tsx'
import { UpdateField } from './update-field.tsx'

async function renderField(state: UpdateState): Promise<TestUpdateService> {
  const update = createTestUpdateService(state)
  setDefaultUpdate(update)
  await render(
    <UpdateProvider autoCheck={false}>
      <UpdateField />
    </UpdateProvider>,
  )
  return update
}

afterEach(() => {
  setDefaultUpdate(null)
})

describe('UpdateField', () => {
  it('retries the install after an install failure: the found update is still there', async () => {
    const update = await renderField({
      phase: 'error',
      message: 'signature verification failed',
      during: 'install',
    })
    expect(page.getByRole('alert').element().textContent).toMatch(/signature verification failed/)
    await userEvent.click(page.getByRole('button', { name: 'Retry install' }))
    expect(update.calls).toEqual(['retryAction', 'install'])
  })

  it('re-checks after a check failure', async () => {
    const update = await renderField({
      phase: 'error',
      message: 'release endpoint unreachable',
      during: 'check',
    })
    await userEvent.click(page.getByRole('button', { name: 'Check for updates' }))
    expect(update.calls).toEqual(['retryAction', 'checkNow'])
  })
})
