import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

function validateAccessibleResources(manifest, files, checkFile) {
  for (const group of manifest.web_accessible_resources ?? []) {
    for (const resource of group.resources ?? []) {
      const pattern = new RegExp(
        "^" +
          resource
            .split("*")
            .map((part) => part.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join(".*") +
          "$"
      )
      const matches = files.filter((file) => pattern.test(file))
      assert.ok(matches.length > 0, `Missing accessible resource: ${resource}`)
      for (const file of matches) {
        checkFile(file)
      }
    }
  }
}

function validateHtmlResources(root, referencedFiles, checkFile) {
  for (const file of [...referencedFiles].filter((file) =>
    file.endsWith(".html")
  )) {
    const html = fs.readFileSync(path.join(root, file), "utf8")
    for (const match of html.matchAll(
      /<(?:script|link|img)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi
    )) {
      const resource = match[1]
      if (!/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(resource)) {
        checkFile(path.join(path.dirname(file), resource.split(/[?#]/)[0]))
      }
    }
  }
}

export function validateSafariBuild(directory) {
  const root = fs.realpathSync(directory)
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.json"), "utf8")
  )
  const referencedFiles = new Set()
  const checkFile = (relativePath) => {
    assert.equal(
      typeof relativePath,
      "string",
      "Resource paths must be strings"
    )
    const fullPath = path.resolve(root, relativePath)
    assert.ok(
      fullPath.startsWith(root + path.sep),
      `Resource escapes the build directory: ${relativePath}`
    )
    assert.ok(
      fs.statSync(fullPath).isFile(),
      `Missing resource: ${relativePath}`
    )
    assert.ok(
      fs.realpathSync(fullPath).startsWith(root + path.sep),
      `Resource symlink escapes the build directory: ${relativePath}`
    )
    referencedFiles.add(relativePath)
    return fullPath
  }

  assert.equal(manifest.manifest_version, 3, "Safari requires the MV3 build")
  assert.ok(
    !manifest.browser_specific_settings,
    "Remove Gecko-specific settings"
  )
  for (const permission of ["storage", "scripting"]) {
    assert.ok(
      manifest.permissions?.includes(permission),
      `Missing ${permission}`
    )
  }

  for (const match of ["http://*/*", "https://*/*"]) {
    assert.ok(
      manifest.host_permissions?.includes(match),
      `Missing host ${match}`
    )
  }

  const backgroundPath = checkFile(manifest.background?.service_worker)
  const popupPath = checkFile(manifest.action?.default_popup)
  assert.ok(
    manifest.content_scripts?.some(
      (script) =>
        script.run_at === "document_start" &&
        script.all_frames === true &&
        ["http://*/*", "https://*/*"].every((match) =>
          script.matches?.includes(match)
        )
    ),
    "Missing all-frame document_start content script"
  )
  for (const script of manifest.content_scripts) {
    // Static MAIN world needs Safari 18; this build uses dynamic registration.
    assert.ok(!script.world, "Use Plasmo dynamic MAIN world registration")
    for (const resource of [...(script.js ?? []), ...(script.css ?? [])]) {
      checkFile(resource)
    }
  }

  for (const icon of [
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action.default_icon ?? {}),
  ]) {
    checkFile(icon)
  }

  if (manifest.options_ui?.page) {
    checkFile(manifest.options_ui.page)
  }

  if (manifest.options_page) {
    checkFile(manifest.options_page)
  }

  const files = fs
    .readdirSync(root, { recursive: true })
    .filter((file) => fs.statSync(path.join(root, file)).isFile())
  validateAccessibleResources(manifest, files, checkFile)
  validateHtmlResources(root, referencedFiles, checkFile)

  const popup = fs.readFileSync(popupPath, "utf8")
  assert.ok(/<script\b/i.test(popup), "Popup has no script")

  const background = fs.readFileSync(backgroundPath, "utf8")
  assert.ok(
    /registerContentScripts\s*\(/.test(background) &&
      /world\s*:\s*["']MAIN["']/.test(background) &&
      /runAt\s*:\s*["']document_start["']/.test(background),
    "Missing dynamic MAIN world document_start registration"
  )
  const shadowScripts = files.filter((file) =>
    /^shadow-root\..*\.js$/.test(file)
  )
  assert.equal(
    shadowScripts.length,
    1,
    "Expected one Shadow DOM injection script"
  )
  const [shadowScript] = shadowScripts
  assert.ok(
    background.includes(shadowScript),
    "Background does not reference Shadow DOM script"
  )
  const shadow = fs.readFileSync(checkFile(shadowScript), "utf8")
  assert.ok(
    shadow.trim().startsWith(";(() => {"),
    "Shadow DOM script needs the IIFE wrapper"
  )

  return {
    directory: root,
    version: manifest.version,
    files: referencedFiles.size,
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(validateSafariBuild(process.argv[2] ?? "build/safari-mv3-prod"))
  } catch (error) {
    console.error(`Safari build validation failed: ${error.message}`)
    process.exitCode = 1
  }
}
