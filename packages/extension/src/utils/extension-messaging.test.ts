import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('browser', undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('settings messages', () => {
  it.each(['chrome-mv3', 'firefox-mv2', 'firefox-mv3', 'safari-mv3'])(
    '%s opens settings only for the settings message',
    async (target) => {
      vi.stubEnv('PLASMO_TARGET', target)
      const addListener = vi.fn()
      vi.stubGlobal('chrome', { runtime: { onMessage: { addListener } } })
      const { registerSettingsMessageListener } =
        await import('./extension-messaging')
      const showSettings = vi.fn()
      registerSettingsMessageListener(showSettings)
      const listener = addListener.mock.calls[0][0] as (message: {
        type: string
      }) => void
      listener({ type: 'HTTP_REQUEST' })
      expect(showSettings).not.toHaveBeenCalled()
      listener({ type: 'utags:show-settings' })
      expect(showSettings).toHaveBeenCalledOnce()
    }
  )

  it('does not register an extension listener in a userscript', async () => {
    vi.stubEnv('PLASMO_TARGET', 'userscript')
    const addListener = vi.fn()
    vi.stubGlobal('chrome', { runtime: { onMessage: { addListener } } })
    const { registerSettingsMessageListener } =
      await import('./extension-messaging')
    registerSettingsMessageListener(vi.fn())
    expect(addListener).not.toHaveBeenCalled()
  })

  it('waits for tab messaging and addresses only the top frame', async () => {
    let finish: (() => void) | undefined
    const sendMessage = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const query = vi.fn().mockResolvedValue([{ id: 0 }])
    vi.stubGlobal('browser', { tabs: { query, sendMessage } })
    const { openSettingsInActiveTab } = await import('./extension-messaging')
    let completed = false
    const request = (async () => {
      await openSettingsInActiveTab()
      completed = true
    })()
    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledOnce()
    })
    expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true })
    expect(sendMessage).toHaveBeenCalledWith(
      0,
      { type: 'utags:show-settings' },
      { frameId: 0 }
    )
    expect(completed).toBe(false)
    finish!()
    await request
    expect(completed).toBe(true)
  })

  it('reports a blocked page instead of silently closing the popup', async () => {
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 1 }]),
        sendMessage: vi.fn().mockRejectedValue(new Error('No receiving end')),
      },
    })
    const { openSettingsInActiveTab } = await import('./extension-messaging')
    await expect(openSettingsInActiveTab()).rejects.toThrow('No receiving end')
  })
})
