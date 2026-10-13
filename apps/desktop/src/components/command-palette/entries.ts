import type { PaletteSections as CorePaletteSections } from '@reflect/core'
import type { AppCommand } from '@/lib/commands/types.ts'

/**
 * The palette's section assembly lives in `@reflect/core`; this module re-exports it.
 */
export { buildPaletteSections, type NoteEntry, type PaletteHit } from '@reflect/core'

/**
 * The palette's sections, with this app's commands.
 */
export type PaletteSections = CorePaletteSections<AppCommand>
