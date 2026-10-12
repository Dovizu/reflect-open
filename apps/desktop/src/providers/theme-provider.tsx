import {
  createContext,
  use,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  defaultTheme,
  type ResolvedTheme as CoreResolvedTheme,
  type ThemePreference,
} from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'

/** User-selectable theme; `system` follows the OS preference. */
export type Theme = ThemePreference

/** The concrete theme actually applied to the document. */
export type ResolvedTheme = CoreResolvedTheme

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

interface ThemeProviderProps {
  children: ReactNode
}

/**
 * Provides the app theme and applies it by toggling the design-system `.dark`
 * scope on the document root.
 *
 * Applying the theme waits for the settings load to settle. Until then the
 * preference is the `system` default rather than the user's choice, and
 * `public/theme-init.js` has already painted the cached preference. Writing the
 * default over it would flash a pinned-light user on a dark OS to dark and
 * straight back.
 */
export function ThemeProvider({ children }: ThemeProviderProps): ReactElement {
  const service = useAppServices({ optional: true })?.theme ?? defaultTheme()
  const theme = useSyncExternalStore(service.subscribe, service.preference)
  const resolvedTheme = useSyncExternalStore(service.subscribe, service.resolved)
  const settled = useSyncExternalStore(service.subscribe, service.settled)

  useEffect(() => {
    if (!settled) {
      return
    }
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
  }, [settled, resolvedTheme])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme: service.setPreference }),
    [theme, resolvedTheme, service],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

/** Access the current theme and a setter. Must be used within a ThemeProvider. */
export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
