import { useCallback } from 'react'
import type {
  TagItem,
  TagSearchHandler,
  WikilinkItem,
  WikilinkSearchHandler,
} from '@meowdown/react'
import { useContactsAuthorization } from '@/hooks/use-contacts-authorization.ts'
import { useGraph } from '@/providers/graph-provider.tsx'
import { useWikiLinkSuggestionService } from '@/services/use-search-services.ts'

/** The `[[` and `#` autocomplete search handlers a {@link NoteEditor} wires up. */
export interface EditorAutocomplete {
  /** Search notes for the `[[` menu: ranked suggestions plus a trailing "Create" row. */
  onWikilinkSearch: WikilinkSearchHandler
  /** Search tags for the `#` menu, most-used first. */
  onTagSearch: TagSearchHandler
}

/**
 * The editor's `[[` and `#` autocomplete, shared by every note editor (the
 * note pane and the Tasks view's inline editor). meowdown owns the menu UI;
 * the rows come from `WikiLinkSuggestionService`. Both handlers are no-ops
 * without an open graph.
 *
 * A consumer wires whichever menus it wants — the note pane and the task editor
 * both take `onWikilinkSearch` and `onTagSearch` — so returning both here never
 * forces a menu onto an editor that doesn't pass it through.
 */
export function useEditorAutocomplete(): EditorAutocomplete {
  const { graph } = useGraph()
  const authorization = useContactsAuthorization()
  const wikiLinkSuggestions = useWikiLinkSuggestionService()
  const generation = graph?.generation ?? null

  const onWikilinkSearch = useCallback(
    async (query: string): Promise<WikilinkItem[]> => {
      if (generation === null) {
        return []
      }
      return await wikiLinkSuggestions.suggestLinks(query, {
        generation,
        contactsAuthorization: authorization,
      })
    },
    [generation, authorization, wikiLinkSuggestions],
  )

  const onTagSearch = useCallback(
    async (query: string): Promise<TagItem[]> => {
      if (graph === null) {
        return []
      }
      return await wikiLinkSuggestions.suggestTags(query)
    },
    [graph, wikiLinkSuggestions],
  )

  return { onWikilinkSearch, onTagSearch }
}
