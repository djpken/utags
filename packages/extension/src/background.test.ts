import { afterEach, beforeEach, expect, it, vi } from 'vitest'

type RequestListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void
) => boolean | undefined

let listener: RequestListener

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener(callback: RequestListener) {
          listener = callback
        },
      },
      onInstalled: { addListener: vi.fn() },
      // onStartup is optional: Safari must still initialize without it.
    },
  })
  await import('./background')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function request(timeout = 100) {
  const reply = vi.fn()
  expect(
    listener(
      {
        type: 'HTTP_REQUEST',
        id: 'request-1',
        payload: { method: 'GET', url: 'https://example.org/data', timeout },
      },
      {},
      reply
    )
  ).toBe(true)
  return reply
}

it('returns the HTTP body and headers and clears the timeout', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response('tags', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      })
    )
  )
  const reply = request()
  await vi.advanceTimersByTimeAsync(0)
  expect(reply).toHaveBeenCalledWith({
    success: true,
    data: {
      ok: true,
      status: 200,
      statusText: '',
      headers: { 'content-type': 'text/plain' },
      body: 'tags',
    },
  })
  expect(vi.getTimerCount()).toBe(0)
})

it('returns network errors and clears their timeout', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('Network unavailable'))
  )
  const reply = request()
  await vi.advanceTimersByTimeAsync(0)
  expect(reply).toHaveBeenCalledWith(
    expect.objectContaining({
      success: false,
      error: 'Network unavailable',
    })
  )
  expect(vi.getTimerCount()).toBe(0)
})

it('aborts a request that exceeds its timeout', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal!.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
    )
  )
  const reply = request(100)
  await vi.advanceTimersByTimeAsync(99)
  expect(reply).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(reply).toHaveBeenCalledWith(
    expect.objectContaining({
      success: false,
      error: 'Request timeout',
    })
  )
  expect(vi.getTimerCount()).toBe(0)
})
