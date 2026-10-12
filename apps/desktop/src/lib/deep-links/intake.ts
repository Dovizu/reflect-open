import { defaultDeepLink } from '@reflect/core'

/** Feed one `reflect://` URL into the intake as if the OS had delivered it. */
export function dispatchDeepLink(url: string): void {
  defaultDeepLink().dispatch(url)
}

/** Subscribe to the deep-link plugin once for the app's lifetime. */
export async function startDeepLinkListener(): Promise<void> {
  await defaultDeepLink().startListener()
}
