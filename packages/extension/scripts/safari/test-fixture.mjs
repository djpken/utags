/* eslint-disable camelcase -- WebExtension manifest keys use the browser schema. */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "utags-safari-test-"))
  const directory = path.join(root, "build", "safari-mv3-prod")
  fs.mkdirSync(directory, { recursive: true })
  const manifest = {
    manifest_version: 3,
    version: "0.34.2",
    permissions: ["storage", "scripting"],
    host_permissions: ["https://*/*", "http://*/*"],
    background: { service_worker: "background.js" },
    action: { default_popup: "popup.html" },
    content_scripts: [
      {
        js: ["content.js"],
        matches: ["https://*/*", "http://*/*"],
        all_frames: true,
        run_at: "document_start",
      },
    ],
    web_accessible_resources: [
      { resources: ["styles/*.css"], matches: ["https://*/*"] },
    ],
  }
  fs.mkdirSync(path.join(directory, "styles"))
  const files = {
    "background.js":
      'chrome.scripting.registerContentScripts([{js:["shadow-root.test.js"], world:"MAIN", runAt:"document_start"}])',
    "content.js": "console.log('UTags')",
    "popup.html": '<html><script src="popup.js"></script></html>',
    "popup.js": "console.log('popup')",
    "shadow-root.test.js": ";(() => {console.log('shadow')})()",
    "styles/content.css": "body {}",
  }
  for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, file), content)
  }

  const saveManifest = () =>
    fs.writeFileSync(
      path.join(directory, "manifest.json"),
      JSON.stringify(manifest)
    )
  saveManifest()
  return { root, directory, manifest, saveManifest }
}
