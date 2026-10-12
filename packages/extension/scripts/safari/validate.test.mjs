/* eslint-disable camelcase -- WebExtension manifest keys use the browser schema. */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { afterEach, test } from "node:test"
import { fileURLToPath } from "node:url"

import { createFixture } from "./test-fixture.mjs"
import { validateSafariBuild } from "./validate.mjs"

const roots = []
afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function fixture() {
  const result = createFixture()
  roots.push(result.root)
  return result
}

test("validates packaged resources including HTML and resource globs", () => {
  const { directory } = fixture()
  assert.equal(validateSafariBuild(directory).version, "0.34.2")
})

test("rejects missing popup assets", () => {
  const { directory } = fixture()
  fs.unlinkSync(path.join(directory, "popup.js"))
  assert.throws(() => validateSafariBuild(directory), /popup\.js/)
})

test("rejects resources outside the package", () => {
  const { directory, manifest, saveManifest } = fixture()
  manifest.content_scripts[0].js = ["../outside.js"]
  saveManifest()
  assert.throws(
    () => validateSafariBuild(directory),
    /escapes the build directory/
  )
})

test("rejects an inaccessible resource glob", () => {
  const { directory, manifest, saveManifest } = fixture()
  manifest.web_accessible_resources[0].resources = ["missing/*.css"]
  saveManifest()
  assert.throws(
    () => validateSafariBuild(directory),
    /Missing accessible resource/
  )
})

test("rejects missing scripting permission and MAIN registration", () => {
  const { directory, manifest, saveManifest } = fixture()
  manifest.permissions = ["storage"]
  saveManifest()
  assert.throws(() => validateSafariBuild(directory), /Missing scripting/)
  manifest.permissions.push("scripting")
  saveManifest()
  fs.writeFileSync(
    path.join(directory, "background.js"),
    "console.log('no registration')"
  )
  assert.throws(() => validateSafariBuild(directory), /Missing dynamic MAIN/)
})

test("rejects an unwrapped Shadow DOM script", () => {
  const { directory } = fixture()
  fs.writeFileSync(
    path.join(directory, "shadow-root.test.js"),
    "console.log('unwrapped')"
  )
  assert.throws(() => validateSafariBuild(directory), /IIFE wrapper/)
})

test("manifest cleanup preserves resources and is idempotent", () => {
  const { root, directory, manifest, saveManifest } = fixture()
  manifest.browser_specific_settings = { gecko: { id: "test@example.org" } }
  manifest.content_scripts[0].css = []
  manifest.web_accessible_resources[0].resources.push("content.deadbeef.css")
  saveManifest()
  const script = fileURLToPath(new URL("update-manifest.mjs", import.meta.url))
  for (let iteration = 0; iteration < 2; iteration++) {
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    })
    assert.equal(result.status, 0, result.stderr)
  }

  const cleaned = JSON.parse(
    fs.readFileSync(path.join(directory, "manifest.json"))
  )
  assert.equal(cleaned.browser_specific_settings, undefined)
  assert.equal(cleaned.content_scripts[0].css, undefined)
  assert.deepEqual(cleaned.web_accessible_resources[0].resources, [
    "styles/*.css",
  ])
  validateSafariBuild(directory)
})

test("cleanup keeps a missing CSS resource if JavaScript actually references it", () => {
  const { root, directory, manifest, saveManifest } = fixture()
  manifest.web_accessible_resources[0].resources.push("content.deadbeef.css")
  saveManifest()
  fs.appendFileSync(
    path.join(directory, "content.js"),
    ';chrome.runtime.getURL("content.deadbeef.css")'
  )
  const script = fileURLToPath(new URL("update-manifest.mjs", import.meta.url))
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
  })
  assert.equal(result.status, 0, result.stderr)
  assert.throws(
    () => validateSafariBuild(directory),
    /Missing accessible resource/
  )
})
