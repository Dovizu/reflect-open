import type { LifecycleDomAdapter } from '@reflect/core'

/** Lifecycle signals from a page's `window` and `document`. */
export function createDomLifecycleAdapter(
  target: { window: Window; document: Document } = { window, document },
): LifecycleDomAdapter {
  return {
    onPageEvent(type, listener) {
      target.window.addEventListener(type, listener)
      return () => {
        target.window.removeEventListener(type, listener)
      }
    },
    onVisibilityChange(listener) {
      target.document.addEventListener('visibilitychange', listener)
      return () => {
        target.document.removeEventListener('visibilitychange', listener)
      }
    },
    isHidden: () => target.document.visibilityState === 'hidden',
  }
}
