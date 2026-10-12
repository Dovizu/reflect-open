import type { ContactsAuthorization } from './contacts-service.ts'

/** The `contacts` capability's shapes and the permission policy. */

export {
  contactMatchSchema,
  contactsAuthorizationSchema,
  type ContactMatch,
  type ContactsAuthorization,
} from './contacts-service.ts'

/** Can lookups be issued right now? `limited` (iOS 18+) still reads the shared subset. */
export function isContactsReadable(status: ContactsAuthorization): boolean {
  return status === 'authorized' || status === 'limited'
}
