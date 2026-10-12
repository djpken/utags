import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('focus-trap-lite', () => ({ initFocusTrap: vi.fn() }))

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  for (const element of document.querySelectorAll('.utags_modal')) {
    element.remove()
  }

  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('keeps Safari panels inside the visible viewport and removes listeners', async () => {
  vi.stubEnv('PLASMO_TARGET', 'safari-mv3')
  const viewport = Object.assign(new EventTarget(), {
    width: 390,
    height: 700,
    offsetTop: 0,
    offsetLeft: 0,
  })
  vi.stubGlobal('visualViewport', viewport)
  const removeListener = vi.spyOn(viewport, 'removeEventListener')
  const { default: createModal } = await import('./modal')
  const modal = createModal()
  modal.append(document.body)
  const wrapper = document.querySelector<HTMLElement>('.utags_modal_wrapper')!
  expect(wrapper.style.height).toBe('700px')
  viewport.height = 320
  viewport.offsetTop = 100
  viewport.dispatchEvent(new Event('resize'))
  expect(wrapper.style.height).toBe('320px')
  expect(wrapper.style.top).toBe('100px')
  modal.remove()
  expect(removeListener).toHaveBeenCalledTimes(2)
  viewport.height = 700
  viewport.dispatchEvent(new Event('resize'))
  expect(wrapper.style.height).toBe('320px')
})

it('preserves the existing modal layout on Chrome', async () => {
  vi.stubEnv('PLASMO_TARGET', 'chrome-mv3')
  vi.stubGlobal('visualViewport', { addEventListener: vi.fn() })
  const { default: createModal } = await import('./modal')
  const modal = createModal()
  modal.append(document.body)
  const wrapper = document.querySelector<HTMLElement>('.utags_modal_wrapper')!
  expect(wrapper.style.height).toBe('')
  modal.remove()
})
