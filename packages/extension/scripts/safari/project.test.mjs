import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { afterEach, test } from "node:test"
import { fileURLToPath } from "node:url"

import { createSafariProject } from "./project.mjs"
import { createFixture } from "./test-fixture.mjs"

const roots = []
afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function fixture() {
  const result = createFixture()
  roots.push(result.root)
  return {
    platform: "darwin",
    buildDirectory: result.directory,
    projectLocation: path.join(result.root, "xcode"),
  }
}

function runner({ legacy = false, missingOptions = false, fail = false } = {}) {
  const calls = []
  const run = (command, args) => {
    calls.push({ command, args })
    if (args[0] === "--find") {
      return {
        status: legacy && args[1] === "safari-web-extension-packager" ? 1 : 0,
      }
    }

    if (args[1] === "--help") {
      return {
        status: 0,
        stdout: missingOptions
          ? "--help"
          : "--project-location --app-name --bundle-identifier --swift --copy-resources --no-open --no-prompt",
      }
    }

    return { status: fail ? 1 : 0 }
  }

  return { run, calls }
}

test("Linux fails before invoking Xcode", () => {
  const { run, calls } = runner()
  assert.throws(
    () => createSafariProject({ platform: "linux", run }),
    /requires macOS/
  )
  assert.equal(calls.length, 0)
})

test("protects an existing output directory and its signing settings", () => {
  const options = fixture()
  fs.mkdirSync(options.projectLocation)
  fs.writeFileSync(
    path.join(options.projectLocation, "signing.txt"),
    "personal-team"
  )
  const { run, calls } = runner()
  assert.throws(
    () => createSafariProject({ ...options, run }),
    /Output already exists/
  )
  assert.equal(calls.length, 0)
  assert.equal(
    fs.readFileSync(path.join(options.projectLocation, "signing.txt"), "utf8"),
    "personal-team"
  )
})

test("generates both platforms with copied resources and custom identity", () => {
  const options = fixture()
  const { run, calls } = runner()
  createSafariProject({
    ...options,
    run,
    appName: "UTags Personal",
    bundleIdentifier: "net.example.utags",
  })
  const { command, args } = calls.at(-1)
  assert.equal(command, "xcrun")
  assert.equal(args[0], "safari-web-extension-packager")
  assert.ok(args.includes("UTags Personal"))
  assert.ok(args.includes("net.example.utags"))
  assert.ok(args.includes("--copy-resources"))
  assert.ok(args.includes("--no-open"))
  assert.ok(!args.includes("--force"))
  assert.ok(!args.includes("--ios-only"))
  assert.ok(!args.includes("--macos-only"))
})

test("falls back to the legacy tool name", () => {
  const { run, calls } = runner({ legacy: true })
  createSafariProject({ ...fixture(), run })
  assert.equal(calls.at(-1).args[0], "safari-web-extension-converter")
})

test("stops when the installed tool lacks required options", () => {
  const { run, calls } = runner({ missingOptions: true })
  assert.throws(
    () => createSafariProject({ ...fixture(), run }),
    /required options/
  )
  assert.equal(calls.length, 2)
})

test("reports packaging failure instead of claiming a generated project", () => {
  const { run } = runner({ fail: true })
  assert.throws(
    () => createSafariProject({ ...fixture(), run }),
    /generation failed/
  )
})

test("reports a missing Xcode packaging tool", () => {
  const calls = []
  const run = (command, args) => {
    calls.push({ command, args })

    return { status: 1 }
  }

  assert.throws(
    () => createSafariProject({ ...fixture(), run }),
    /packaging tool not found/
  )
  assert.equal(calls.length, 2)
})

test("rejects an invalid bundle identifier before invoking Xcode", () => {
  const { run, calls } = runner()
  assert.throws(
    () =>
      createSafariProject({
        ...fixture(),
        run,
        bundleIdentifier: "not a bundle ID",
      }),
    /reverse-DNS/
  )
  assert.equal(calls.length, 0)
})

test("CLI rejects unknown options rather than silently ignoring them", () => {
  const script = fileURLToPath(new URL("project.mjs", import.meta.url))
  const result = spawnSync(process.execPath, [script, "--unknown-option"], {
    encoding: "utf8",
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /unknown-option/)
})

test(
  "CLI parses documented options and reports the Linux platform restriction",
  {
    skip: process.platform !== "linux",
  },
  () => {
    const script = fileURLToPath(new URL("project.mjs", import.meta.url))
    const result = spawnSync(
      process.execPath,
      [
        script,
        "--app-name",
        "UTags Personal",
        "--bundle-identifier",
        "net.example.utags",
        "--project-location",
        "build/unused-test-output",
      ],
      { encoding: "utf8" }
    )
    assert.equal(result.status, 1)
    assert.match(result.stderr, /requires macOS and Xcode/)
  }
)
