import { describe, expect, it } from 'vitest'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import { createContactsService } from './contacts-service.ts'

const ADA = {
  fullName: 'Ada Lovelace',
  givenName: 'Ada',
  familyName: 'Lovelace',
  emails: ['ada@example.com'],
  phones: [],
}
describe('createContactsService', () => {
  it('reads the permission state and requests access', async () => {
    const ipc = createTestIpcBridgeService({
      commands: {
        contacts_authorization_status: () => 'unavailable',
        contacts_request_access: () => false,
      },
    })
    const contacts = createContactsService({ ipc })

    await expect(contacts.authorizationStatus()).resolves.toBe('unavailable')
    await expect(contacts.requestAccess()).resolves.toBe(false)
  })

  it('looks contacts up by email and by name', async () => {
    const ipc = createTestIpcBridgeService({
      commands: {
        contacts_lookup_by_email: () => [ADA],
        contacts_lookup_by_name: () => [{ ...ADA, phones: 'odd' }],
      },
    })
    const contacts = createContactsService({ ipc })

    await expect(contacts.lookupByEmail('ada@example.com')).resolves.toEqual([ADA])
    await expect(contacts.lookupByName('Ada')).resolves.toEqual([ADA])
    expect(ipc.calls()).toEqual([
      { command: 'contacts_lookup_by_email', args: { email: 'ada@example.com' } },
      { command: 'contacts_lookup_by_name', args: { name: 'Ada' } },
    ])
  })
})
