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

let defaultHttpInstance: HttpService | null = null

/** The process-wide HTTP service; a browser service unless {@link setDefaultHttp} installed another. */
export function defaultHttp(): HttpService {
  defaultHttpInstance ??= createBrowserHttpService()
  return defaultHttpInstance
}

/** Installs the process-wide HTTP service; `null` restores a lazily created browser service. */
export function setDefaultHttp(service: HttpService | null): void {
  defaultHttpInstance = service
}
