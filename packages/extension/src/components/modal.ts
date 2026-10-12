import {
  addClass,
  addElement,
  createElement,
  doc,
} from 'browser-extension-utils'
import { initFocusTrap } from 'focus-trap-lite'

import { isSafariExtension } from '../utils/environment'

export default function createModal(attributes?: Record<string, unknown>) {
  const div = createElement('div', {
    class: 'utags_modal',
    'data-utags_exclude': '',
  })

  const wrapper = addElement(div, 'div', {
    class: 'utags_modal_wrapper',
    'data-utags_exclude': '',
  })

  const content = addElement(wrapper, 'div', attributes)

  addClass(content, 'utags_modal_content')
  let removed = false
  let cleanupViewport: (() => void) | undefined
  return {
    remove() {
      if (!removed) {
        removed = true
        cleanupViewport?.()
        div.remove()
      }
    },
    append(element?: HTMLElement) {
      ;(element || doc.documentElement).append(div)
      const viewport = globalThis.visualViewport
      if (isSafariExtension && viewport && wrapper && !cleanupViewport) {
        // Safari's layout viewport can remain behind the iPhone keyboard.
        // Keep the scrollable panel inside the actually visible viewport.
        const updateViewport = () => {
          Object.assign(wrapper.style, {
            width: `${viewport.width}px`,
            height: `${viewport.height}px`,
            top: `${viewport.offsetTop}px`,
            left: `${viewport.offsetLeft}px`,
            right: 'auto',
            bottom: 'auto',
            boxSizing: 'border-box',
          })
        }

        updateViewport()
        viewport.addEventListener('resize', updateViewport)
        viewport.addEventListener('scroll', updateViewport)
        cleanupViewport = () => {
          viewport.removeEventListener('resize', updateViewport)
          viewport.removeEventListener('scroll', updateViewport)
        }
      }

      initFocusTrap(div)
    },
    getContentElement() {
      return content
    },
  }
}
