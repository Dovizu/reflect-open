import {
  defaultClassicAccess,
  type ClassicAccess,
  type ClassicSignInOptions,
  type ClassicSignInResult,
} from './classic-access-service.ts'

export {
  CLASSIC_ACCESS_SECRET,
  classicAccessSchema,
  classicAccessUntil,
  classicPaidThrough,
  isClassicAccessActive,
  type ClassicAccess,
  type ClassicInvoice,
  type ClassicSignInResult,
} from './classic-access-service.ts'
export type { StartWebAuth } from '../ipc/web-auth-plugin.ts'

/** `ClassicAccessService.read` on the process-wide service. */
export async function readClassicAccess(): Promise<ClassicAccess | null> {
  return await defaultClassicAccess().read()
}

/** `ClassicAccessService.signIn` on the process-wide service. */
export async function signInWithClassic(
  options: ClassicSignInOptions,
): Promise<ClassicSignInResult> {
  return await defaultClassicAccess().signIn(options)
}

/** `ClassicAccessService.load` on the process-wide service. */
export async function loadClassicAccess(): Promise<ClassicAccess | null> {
  return await defaultClassicAccess().load()
}

/** `ClassicAccessService.signOut` on the process-wide service. */
export async function clearClassicAccess(): Promise<void> {
  await defaultClassicAccess().signOut()
}
