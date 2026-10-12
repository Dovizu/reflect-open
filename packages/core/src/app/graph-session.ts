/** One open graph: its identity, both session generations, and its lifetime. */
export interface GraphSession {
  /** Absolute path of the graph root. */
  readonly root: string
  /** Display name (the root folder name). */
  readonly name: string
  /** The file session generation from `graph_open`. */
  readonly generation: number
  /** The index session generation from `index_open`. */
  readonly indexGeneration: number
  /** Aborts when the graph closes or another graph replaces it. */
  readonly signal: AbortSignal
}

/** A {@link GraphSession} over `fields`. Without `signal`, the session never aborts. */
export function createGraphSession(
  fields: Omit<GraphSession, 'signal'>,
  signal?: AbortSignal,
): GraphSession {
  return {
    root: fields.root,
    name: fields.name,
    generation: fields.generation,
    indexGeneration: fields.indexGeneration,
    signal: signal ?? new AbortController().signal,
  }
}
