import { once } from '@ocavue/utils'
import { z } from 'zod'

export interface LicenseEntry {
  name: string
  ecosystem: 'npm' | 'cargo' | 'other'
  license: string
  url?: string
  /** Indexes into {@link Licenses.texts}; empty when the package ships no license file. */
  texts: number[]
}

export interface Licenses {
  entries: LicenseEntry[]
  texts: string[]
}

/**
 * The compact shape that `scripts/generate-licenses.ts` writes. Each entry is
 * a `[name, ecosystem, license, url, texts]` tuple, where `license` indexes
 * `licenses` and `texts` indexes `texts`. Each text is a list of indexes into
 * `paragraphs`.
 */
const LicensesFileSchema = z.object({
  licenses: z.array(z.string()),
  paragraphs: z.array(z.string()),
  texts: z.array(z.array(z.int())),
  entries: z.array(
    z.tuple([
      z.string(),
      z.enum(['npm', 'cargo', 'other']),
      z.int(),
      z.string().nullable(),
      z.array(z.int()),
    ]),
  ),
})

/** Loads the generated notices, which Vite splits into their own lazy chunk. */
async function loadLicenses(): Promise<Licenses> {
  const { default: data } = await import('./licenses.gen.json')
  const file = LicensesFileSchema.parse(data)
  return {
    entries: file.entries.map(([name, ecosystem, license, url, texts]) => ({
      name,
      ecosystem,
      license: file.licenses[license]!,
      ...(url === null ? {} : { url }),
      texts,
    })),
    texts: file.texts.map((text) => text.map((i) => file.paragraphs[i]!).join('\n\n')),
  }
}

/**
 * The notices, loaded on the first call. Every call returns the same promise,
 * so it can be passed to React's `use`.
 */
export const getLicenses: () => Promise<Licenses> = /* @__PURE__ */ once(loadLicenses)

export function getEntryKey(entry: LicenseEntry): string {
  return `${entry.ecosystem}:${entry.name}`
}
