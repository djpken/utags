// Keep target checks shared by the content script and the HTTP bridge.
// eslint-disable-next-line n/prefer-global/process
const target = process.env.PLASMO_TARGET

export const isChromeExtension = target === 'chrome-mv3'
export const isFirefoxExtension =
  target === 'firefox-mv2' || target === 'firefox-mv3'
export const isSafariExtension = target === 'safari-mv3'
export const isExtension =
  isChromeExtension || isFirefoxExtension || isSafariExtension
// @ts-expect-error The userscript builder defines a target outside Plasmo's union.
export const isUserscript = target === 'userscript'
