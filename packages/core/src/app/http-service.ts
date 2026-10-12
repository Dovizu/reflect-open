/** Outbound HTTP, in the shape of the global `fetch`. */
export interface HttpService {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>
}

/** HTTP backed by the platform's global `fetch`. */
export function createBrowserHttpService(): HttpService {
  return {
    fetch: (input, init) => globalThis.fetch(input, init),
  }
}
