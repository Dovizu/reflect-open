import { useMemo } from 'react'
import type { AppServices, MobileServices } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * `useAppServices()` for the mobile surface tree, with the mobile-only
 * services merged in. The mobile tree runs only on a mobile platform, where
 * `app.mobile` always exists.
 */
export function useMobileAppServices(): AppServices & MobileServices {
  const app = useAppServices()
  return useMemo(() => {
    if (app.mobile === null) {
      throw new Error('useMobileAppServices: the mobile services exist only on a mobile platform')
    }
    return { ...app, ...app.mobile }
  }, [app])
}
