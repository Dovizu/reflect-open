import type { HttpService } from '../app/http-service.ts'

/** A request the fake received. */
export interface TestHttpRequest {
  method: string
  url: string
  headers: Headers
  body: string | null
}

export type TestHttpHandler = (request: Request) => Response | Promise<Response>

/** A canned reply: a handler, a `Response`, or a JSON body with a status. */
export type TestHttpReply = TestHttpHandler | Response | { status: number; json?: unknown }

export type TestHttpMatcher = string | RegExp | ((url: string) => boolean)

export interface TestHttpRoute {
  method: string
  url: TestHttpMatcher
  reply: TestHttpReply
}

export interface TestHttpService extends HttpService {
  /** The fake as a `typeof fetch`. */
  readonly fetchFn: typeof fetch
  /**
   * Answers matching requests with `reply`. `method` is case-insensitive;
   * `*` matches any method. A string `url` matches the exact URL. Later
   * routes win over earlier ones.
   */
  on(method: string, url: TestHttpMatcher, reply: TestHttpReply): void
  requests(): readonly TestHttpRequest[]
}

function matches(matcher: TestHttpMatcher, url: string): boolean {
  if (typeof matcher === 'string') {
    return matcher === url
  }
  if (matcher instanceof RegExp) {
    return matcher.test(url)
  }
  return matcher(url)
}

async function toResponse(reply: TestHttpReply, request: Request): Promise<Response> {
  if (typeof reply === 'function') {
    return await reply(request)
  }
  if (reply instanceof Response) {
    // A `Response` body reads once, so every match gets a copy.
    return reply.clone()
  }
  if (reply.json === undefined) {
    return new Response(null, { status: reply.status })
  }
  return Response.json(reply.json, { status: reply.status })
}

/**
 * An in-memory {@link HttpService}. Requests answer from registered routes;
 * an unmatched request answers `404`.
 */
export function createTestHttpService(routes: readonly TestHttpRoute[] = []): TestHttpService {
  const registered: TestHttpRoute[] = [...routes]
  const log: TestHttpRequest[] = []

  const send = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    const body = request.body === null ? null : await request.clone().text()
    log.push({
      method: request.method,
      url: request.url,
      headers: new Headers(request.headers),
      body,
    })
    const method = request.method.toUpperCase()
    for (let i = registered.length - 1; i >= 0; i--) {
      const route = registered[i]!
      const routeMethod = route.method.toUpperCase()
      if ((routeMethod === '*' || routeMethod === method) && matches(route.url, request.url)) {
        return await toResponse(route.reply, request)
      }
    }
    return new Response(null, { status: 404 })
  }

  return {
    fetch: send,
    fetchFn: (input, init) => send(input, init),
    on(method, url, reply) {
      registered.push({ method, url, reply })
    },
    requests: () => [...log],
  }
}
