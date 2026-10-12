import { defaultLinkNavigation } from '@reflect/core'

/** The user-visible refusal for an ambiguous title: `LinkNavigationService.reportAmbiguousNoteTitle`. */
export function reportAmbiguousNoteTitle(operationLabel: string, title: string): void {
  defaultLinkNavigation().reportAmbiguousNoteTitle(operationLabel, title)
}
