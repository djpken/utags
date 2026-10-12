import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

import { validateSafariBuild } from "./validate.mjs"

function findPackagingTool(run) {
  for (const candidate of [
    "safari-web-extension-packager",
    "safari-web-extension-converter",
  ]) {
    const result = run("xcrun", ["--find", candidate], { encoding: "utf8" })
    if (!result.error && result.status === 0) {
      return candidate
    }
  }

  throw new Error(
    "Xcode Safari packaging tool not found. Install full Xcode and select it with xcode-select."
  )
}

export function createSafariProject({
  buildDirectory = "build/safari-mv3-prod",
  projectLocation = "build/safari-xcode",
  appName = "UTags",
  bundleIdentifier = "com.djpken.utags",
  platform = process.platform,
  run = spawnSync,
} = {}) {
  if (platform !== "darwin") {
    throw new Error(
      "Safari Xcode packaging requires macOS and Xcode. Build the ZIP here, then generate the project on a Mac."
    )
  }

  if (!/^[a-z\d-]+(?:\.[a-z\d-]+)+$/i.test(bundleIdentifier)) {
    throw new Error(
      "Use a reverse-DNS bundle identifier, such as com.djpken.utags."
    )
  }

  const destination = path.resolve(projectLocation)
  if (fs.existsSync(destination)) {
    throw new Error(
      `Output already exists: ${destination}. Choose a new --project-location to preserve signing settings.`
    )
  }

  const { directory } = validateSafariBuild(buildDirectory)

  const tool = findPackagingTool(run)

  const requiredOptions = [
    "--project-location",
    "--app-name",
    "--bundle-identifier",
    "--swift",
    "--copy-resources",
    "--no-open",
    "--no-prompt",
  ]
  const help = run("xcrun", [tool, "--help"], { encoding: "utf8" })
  const helpText = (help.stdout ?? "") + (help.stderr ?? "")
  if (
    help.error ||
    help.status !== 0 ||
    requiredOptions.some((option) => !helpText.includes(option))
  ) {
    throw new Error(
      `Installed ${tool} does not advertise the required options. Update Xcode; no project was overwritten.`
    )
  }

  const result = run(
    "xcrun",
    [
      tool,
      directory,
      "--project-location",
      destination,
      "--app-name",
      appName,
      "--bundle-identifier",
      bundleIdentifier,
      "--swift",
      "--copy-resources",
      "--no-open",
      "--no-prompt",
    ],
    { stdio: "inherit" }
  )
  if (result.error || result.status !== 0) {
    throw new Error(
      `Safari project generation failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}. Review Xcode output and choose a fresh destination before retrying.`
    )
  }

  console.log(
    `Generated macOS/iOS project at ${destination}. Select your team in Xcode for each app and extension target. Review all manifest warnings before running.`
  )
  return destination
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const { values } = parseArgs({
      options: {
        "build-directory": { type: "string" },
        "project-location": { type: "string" },
        "app-name": { type: "string" },
        "bundle-identifier": { type: "string" },
      },
    })
    createSafariProject({
      buildDirectory: values["build-directory"],
      projectLocation: values["project-location"],
      appName: values["app-name"],
      bundleIdentifier: values["bundle-identifier"],
    })
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
