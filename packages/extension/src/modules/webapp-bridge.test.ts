import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('browser', undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

async function dispatchHttpRequest() {
  const register = vi.spyOn(globalThis, 'addEventListener')
  const reply = vi
    .spyOn(globalThis, 'postMessage')
    .mockImplementation(() => undefined)
  const { setupWebappBridge } = await import('./webapp-bridge')
  setupWebappBridge()
  const listener = register.mock.calls.find(([type]) => type === 'message')![1]
  const event = new MessageEvent('message', {
    origin: location.origin,
    source: globalThis.window,
    data: {
      type: 'HTTP_REQUEST',
      source: 'utags-webapp',
      id: 'request-1',
      payload: { method: 'GET', url: 'https://example.org/data' },
    },
  })
  ;(listener as EventListener)(event)
  window.removeEventListener('message', listener)
  return reply
}

describe('HTTP bridge routing', () => {
  it.each(['chrome-mv3', 'firefox-mv2', 'firefox-mv3', 'safari-mv3'])(
    '%s uses the background HTTP proxy',
    async (target) => {
      vi.stubEnv('PLASMO_TARGET', target)
      const data = { ok: true, status: 200, body: 'tags', headers: {} }
      const sendMessage = vi.fn().mockResolvedValue({ success: true, data })
      vi.stubGlobal('chrome', { runtime: { sendMessage } })
      const gmRequest = vi.fn()
      vi.stubGlobal('GM', { xmlHttpRequest: gmRequest })
      const reply = await dispatchHttpRequest()
      await vi.waitFor(() => {
        expect(reply).toHaveBeenCalledOnce()
      })
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'HTTP_REQUEST',
        id: 'request-1',
        payload: { method: 'GET', url: 'https://example.org/data' },
      })
      expect(gmRequest).not.toHaveBeenCalled()
      expect(reply).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'HTTP_RESPONSE', payload: data }),
        { targetOrigin: location.origin }
      )
    }
  )

  it('preserves the userscript HTTP path', async () => {
    vi.stubEnv('PLASMO_TARGET', 'userscript')
    const sendMessage = vi.fn()
    vi.stubGlobal('chrome', { runtime: { sendMessage } })
    const gmRequest = vi.fn(
      (options: { onload: (response: unknown) => void }) => {
        options.onload({ status: 200, responseText: 'userscript-data' })
      }
    )
    vi.stubGlobal('GM', { xmlHttpRequest: gmRequest })
    const reply = await dispatchHttpRequest()
    expect(gmRequest).toHaveBeenCalledOnce()
    expect(sendMessage).not.toHaveBeenCalled()
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HTTP_RESPONSE' }),
      { targetOrigin: location.origin }
    )
  })

  it.each([
    { success: false, error: 'Request timeout' },
    { success: false, error: 'Website permission denied' },
  ])('returns background failures to the webapp: $error', async (response) => {
    vi.stubEnv('PLASMO_TARGET', 'safari-mv3')
    vi.stubGlobal('browser', {
      runtime: { sendMessage: vi.fn().mockResolvedValue(response) },
    })
    const reply = await dispatchHttpRequest()
    await vi.waitFor(() => {
      expect(reply).toHaveBeenCalledOnce()
    })
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'HTTP_ERROR',
        payload: expect.objectContaining({ error: response.error }),
      }),
      { targetOrigin: location.origin }
    )
  })

  it('returns runtime communication failure', async () => {
    vi.stubEnv('PLASMO_TARGET', 'safari-mv3')
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: vi.fn().mockRejectedValue(new Error('Offline')) },
    })
    const reply = await dispatchHttpRequest()
    await vi.waitFor(() => {
      expect(reply).toHaveBeenCalledOnce()
    })
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'HTTP_ERROR',
        payload: expect.objectContaining({
          error: 'Extension communication error',
        }),
      }),
      { targetOrigin: location.origin }
    )
  })
})
