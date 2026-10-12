import { isExtension } from './environment'

export function getExtensionApi(): typeof chrome | undefined {
  return (
    (globalThis as typeof globalThis & { browser?: typeof chrome }).browser ??
    globalThis.chrome
  )
}

export function registerSettingsMessageListener(showSettings: () => unknown) {
  if (!isExtension) {
    return
  }

  getExtensionApi()?.runtime?.onMessage?.addListener(
    (message: { type?: string }) => {
      if (message?.type === 'utags:show-settings') {
        void showSettings()
      }
    }
  )
}

export async function openSettingsInActiveTab(): Promise<void> {
  const api = getExtensionApi()
  if (!api?.tabs?.query || !api.tabs.sendMessage) {
    throw new Error('Settings are unavailable on this page.')
  }

  const [tab] = await api.tabs.query({ active: true, currentWindow: true })
  if (tab?.id === undefined) {
    throw new Error('Open a website before opening UTags settings.')
  }

  // Only the top frame should open the settings panel.
  await api.tabs.sendMessage(
    tab.id,
    { type: 'utags:show-settings' },
    { frameId: 0 }
  )
}
