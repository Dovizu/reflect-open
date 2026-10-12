import { afterEach, describe, expect, it } from 'vitest'
import { createTestContactsService } from '../testing/contacts.ts'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import { lookupContactsByEmail } from './commands.ts'
import { createContactsService, defaultContacts, setDefaultContacts } from './contacts-service.ts'

const ADA = {
  fullName: 'Ada Lovelace',
  givenName: 'Ada',
  familyName: 'Lovelace',
  emails: ['ada@example.com'],
  phones: [],
}

afterEach(() => {
  setDefaultContacts(null)
})

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

describe('defaultContacts', () => {
  it('returns the installed service until it is cleared', () => {
    const fake = createTestContactsService()
    setDefaultContacts(fake)
    expect(defaultContacts()).toBe(fake)

    setDefaultContacts(null)
    expect(defaultContacts()).not.toBe(fake)
  })

  it('backs the free functions', async () => {
    setDefaultContacts(createTestContactsService({ contacts: [ADA] }))
    await expect(lookupContactsByEmail('ADA@example.com')).resolves.toEqual([ADA])
  })
})
