import { useEffect, useState } from 'react'
import { useAppServices } from '@/services/services-provider.tsx'

/** The native app version for display, or `null` until (unless) it resolves. */
export function useAppVersion(): string | null {
  const { appInfo } = useAppServices()
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const result = await appInfo.version()
        if (active) {
          setVersion(result)
        }
      } catch {
        if (active) {
          setVersion(null)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [appInfo])

  return version
}
