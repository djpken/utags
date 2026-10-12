/* eslint-disable camelcase -- WebExtension manifest keys use the browser schema. */
import fs from "node:fs"
import path from "node:path"

const buildDirectory = "build/safari-mv3-prod"
const filePath = path.join(buildDirectory, "manifest.json")
const manifest = JSON.parse(fs.readFileSync(filePath, "utf8"))

delete manifest.browser_specific_settings
for (const script of manifest.content_scripts ?? []) {
  if (script.css?.length === 0) {
    delete script.css
  }
}

// Plasmo lists data-text CSS imports as accessible files even though Parcel
// inlines them into JavaScript. Remove only these unreferenced phantom files;
// preserve emitted resources and let validation catch other missing assets.
const javascript = fs
  .readdirSync(buildDirectory, { recursive: true })
  .filter((file) => file.endsWith(".js"))
  .map((file) => fs.readFileSync(path.join(buildDirectory, file), "utf8"))
if (manifest.web_accessible_resources) {
  manifest.web_accessible_resources = manifest.web_accessible_resources
    .map((group) => ({
      ...group,
      resources: group.resources.filter(
        (resource) =>
          !/^content\.[a-f\d]+\.css$/.test(resource) ||
          fs.existsSync(path.join(buildDirectory, resource)) ||
          javascript.some((script) => script.includes(resource))
      ),
    }))
    .filter((group) => group.resources.length > 0)
  if (manifest.web_accessible_resources.length === 0) {
    delete manifest.web_accessible_resources
  }
}

fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2) + "\n")
