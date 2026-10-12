import { defaultHttp } from '@reflect/core'

/**
 * The transport for direct app to AI-provider calls (BYOK, Plan 10): the
 * process-wide `HttpService`. Inside the Tauri shell that is the HTTP plugin's
 * fetch, so webview CORS does not apply; in plain-browser dev it is the
 * global fetch.
 */
export function providerFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return defaultHttp().fetch(input, init)
}
