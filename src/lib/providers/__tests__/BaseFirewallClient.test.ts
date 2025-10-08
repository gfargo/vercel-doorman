import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { BaseFirewallClient } from '../BaseFirewallClient'

// Minimal test client that avoids real waiting and adds auth headers
class TestClient extends BaseFirewallClient {
  constructor(baseUrl = 'https://api.example.com') {
    super(baseUrl, 'vercel')
  }
  protected getAuthHeaders(): Record<string, string> {
    return { Authorization: 'Bearer TEST' }
  }
  // Avoid real delays during tests
  protected override delay(): Promise<void> {
    return Promise.resolve()
  }
}

// Helper to build Response-like objects
const makeResponse = (init: {
  ok: boolean
  status: number
  statusText?: string
  jsonBody?: unknown
  headers?: Record<string, string>
}): Response => {
  const headers = new Headers(init.headers || {})
  const body = init.jsonBody
  const res = {
    ok: init.ok,
    status: init.status,
    statusText: init.statusText || '',
    headers,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
  return res
}

describe('BaseFirewallClient', () => {
  const client = new TestClient()

  beforeEach(() => {
    jest.spyOn(global, 'fetch' as any).mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('performs GET and returns JSON on success', async () => {
    const data = { hello: 'world' }
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce(
      makeResponse({ ok: true, status: 200, jsonBody: data }),
    )

    const result = await (client as any).get('/test')
    expect(result).toEqual(data)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.com/test')
  })

  it('retries on 429 and succeeds on next attempt', async () => {
    const now = Math.floor(Date.now() / 1000)
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce(
        makeResponse({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          jsonBody: { message: 'Rate limit' },
          headers: { 'X-RateLimit-Reset': String(now + 1) },
        }),
      )
      .mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: { ok: true } }))

    const result = await (client as any).get('/retry', { retries: 1, retryDelay: 1 })
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry on 400 and throws formatted error', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce(
        makeResponse({ ok: false, status: 400, statusText: 'Bad Request', jsonBody: { message: 'bad' } }),
      )

    await expect((client as any).get('/bad', { retries: 2 })).rejects.toThrow(/API error: 400/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats AbortError as non-retryable and throws', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockRejectedValueOnce(abortError)

    await expect((client as any).get('/timeout', { retries: 3, timeout: 10 })).rejects.toThrow(/aborted/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('formats error messages from errors array', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce(
        makeResponse({
          ok: false,
          status: 500,
          statusText: 'Server Error',
          jsonBody: { errors: [{ message: 'foo' }, { bar: 1 }] },
        }),
      )

    await expect((client as any).get('/server', { retries: 0 })).rejects.toThrow(/foo/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('merges headers including auth and custom ones', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce(
      makeResponse({ ok: true, status: 200, jsonBody: { ok: true } }),
    )

    await (client as any).post('/path', { a: 1 }, { headers: { 'X-Custom': '1' } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const args = fetchMock.mock.calls[0]?.[1] as any
    expect(args.method).toBe('POST')
    // Headers can be a plain object; verify key pieces
    expect(args.headers['Content-Type']).toBe('application/json')
    expect(args.headers.Authorization).toBe('Bearer TEST')
    expect(args.headers['X-Custom']).toBe('1')
  })
})
