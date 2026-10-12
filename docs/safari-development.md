# Safari Web Extension development

UTags has a native Safari MV3 build for personal testing on macOS and iPhone.
The API baseline is Safari 16.4 and iOS 16.4. This is a design baseline, not a
claim that every supported version or website has been tested. See
[the validation record](safari-validation.md) for completed checks and pending
device testing. iPad, App Store distribution, TestFlight, and iCloud sync are
outside this first version.

## Build the extension

Use Node.js 22.13 or newer and pnpm 10.6.2. Xcode is required only for app
packaging on a Mac; Linux can build and validate the extension resources.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter utags build:safari
pnpm --filter utags package:safari
```

Outputs:

- `packages/extension/build/safari-mv3-prod/`: unpacked extension resources.
- `packages/extension/build/safari-mv3-prod.zip`: resources for transfer to a Mac.

The ZIP is a WebExtension resource archive, not an installable iPhone app.
`validate:safari` checks the manifest, popup assets, background service worker,
content scripts, and dynamic MAIN world Shadow DOM injection. It does not run
Safari or verify signing. The Safari CI workflow runs tests, builds the ZIP,
validates extracted resources, and uploads an artifact without signing or
publishing an app.

```sh
pnpm --filter utags validate:safari
pnpm --filter utags test
pnpm --filter utags test:safari-tools
pnpm --filter utags test:safari-coverage
```

Safari uses the same bookmark storage keys, settings, import/export format,
webapp messages, and GitHub/WebDAV synchronization flow as the other extensions.
Browser data is separate: installing Safari does not automatically copy Chrome
or userscript data. Use the existing export/import or configured sync workflow
to transfer it.

## Generate the macOS and iOS Xcode project

On a Mac, install full Xcode, open it once to finish its setup, and make sure
`xcode-select -p` points to that Xcode installation. Build the resources as above,
then run:

```sh
pnpm --filter utags safari:project
```

The script checks the installed tool's `--help`, preferring
`safari-web-extension-packager` and falling back to the older
`safari-web-extension-converter` name. It generates Swift containing apps and
extensions for both macOS and iOS, copies the validated resources, and leaves
Xcode closed. The default output parent is
`packages/extension/build/safari-xcode/`, the app name is `UTags`, and the base
bundle identifier is `com.djpken.utags`.

To change these values, append options directly to the pnpm command:

```sh
pnpm --filter utags safari:project --app-name "UTags Personal" --bundle-identifier net.example.utags --project-location build/safari-xcode/personal-v1
```

The paths above are relative to `packages/extension/`, where pnpm runs the
script. To use resources transferred from this VM instead of rebuilding on the
Mac, extract the ZIP to a directory and pass its absolute path:

```sh
pnpm --filter utags safari:project --build-directory /absolute/path/to/extracted-resources --project-location /absolute/path/to/new-xcode-output
```

The generator refuses any existing output path. It never passes `--force` and
does not overwrite a project's signing settings. Use a fresh output directory
for another generation, or copy updated extension resources into the existing
project yourself. Keep the app/extension bundle identifiers and team unchanged
when testing updates and data persistence. Generated files and local signing
settings are not committed.

Review all manifest warnings from Apple's packager. Do not treat a successful
project generation as a successful Xcode build or Safari test.

## Test on macOS Safari

1. Open the generated `.xcodeproj` and choose the macOS app scheme. Review
   Signing & Capabilities for the app and extension targets, then build and run.
2. In Safari's developer settings, allow unsigned extensions if required for
   local development. Enable UTags in Safari Settings > Extensions.
3. Grant website access to the websites under test, including `utags.link` and
   the test GitHub/WebDAV host when testing synchronization. Reload pages that
   were already open when the extension or permission was enabled.
4. Run the acceptance checks below and record macOS, Safari, Xcode, and UTags
   versions in the validation record.

Safari 18.4 and later also offers temporary extension loading from a folder or
ZIP in its developer extension settings. This is useful for a desktop smoke
test without generating an Xcode project. Temporary extensions are removed
after 24 hours or when Safari quits. Use the containing app for restart and
update persistence testing; temporary loading does not install an iPhone app.

The popup keeps itself open and displays a recovery message if settings cannot
be delivered to a page. Grant website access, reload a normal HTTP(S) webpage,
and retry. Safari's internal pages are not content-script targets.

## Test on iPhone

1. Open the generated project on the Mac, connect and trust the iPhone, and
   enable Developer Mode when requested by iOS/Xcode.
2. Select the iOS app scheme and the physical iPhone. Select your Apple Account
   team for both the containing app and its extension target, set both iOS
   deployment targets to 16.4 or newer, then build/run.
3. Enable UTags under the iPhone's Safari extension settings. On newer iOS
   versions, Safari settings are under Settings > Apps > Safari. Grant access to
   the test websites and reload them.
4. Run the touch and persistence checks below, then record the device and iOS
   version. Do not mark this stage complete from simulator or Chrome results.

The first attempt may use your free Apple Account/Personal Team. Apple’s
Safari-specific testing documentation requires Apple Developer Program
membership for device testing, while its general account documentation
describes limited free device provisioning. Free-account Safari signing is
therefore not guaranteed. If Xcode rejects the extension's signing capability
or provisioning profile, record the exact error with personal identifiers
removed and leave iPhone testing pending. This project does not purchase a
membership or switch to TestFlight. If free provisioning is accepted, its
limited validity may require rebuilding/reinstalling later.

## Acceptance checks

Use disposable tags/bookmarks and a dedicated test GitHub repository or WebDAV
directory. Do not point a destructive synchronization test at production data.

| Area | Scenario and expected result |
| --- | --- |
| Website access | Deny access, confirm UTags is inactive, grant access and reload; tagging and settings become available. |
| Core tags | On GitHub, V2EX, and a Discourse site, add, edit, remove tags and notes; test star/hide tags and an SPA navigation. |
| Settings | Open settings from the extension popup on a normal website; one panel opens in the top frame. Changes survive reload. |
| Storage | Open two tabs, edit a tag, confirm both tabs update. Restart Safari and verify tags/settings remain. |
| MAIN world | Run the controlled Shadow DOM probe below after reload, then after restarting Safari; both links remain taggable. |
| Import/export | Export disposable data, change it, import it, and confirm the restored tags and notes. |
| Sync | Discover the Safari extension from `utags.link`; upload/download via the existing GitHub and WebDAV flows. Test invalid credentials, refused host access, offline operation, and retry after recovery. |
| Background lifecycle | Let Safari become idle, then perform another sync request; messaging resumes and failures reach the webapp without hanging indefinitely. |
| iPhone touch | Reveal the tag controls by touch, add/edit tags, open settings, type with the keyboard visible, rotate the phone, and close/reopen panels. Controls stay reachable without hover. |
| App update | Install an updated app using the same identifiers/team without uninstalling it; tags and settings remain. |

For a controlled DOM test, open a disposable HTTP(S) page such as
`https://example.org/`, grant UTags access, reload, and run this in Safari Web
Inspector's page console. It creates default-selector links and a closed
Shadow DOM after content-script injection:

```js
const probe = document.createElement('section')
probe.id = 'utags-safari-probe'
const direct = document.createElement('a')
direct.href = 'https://example.org/utags-direct'
direct.textContent = 'UTags direct probe'
direct.setAttribute('data-utags_link', '')
probe.append(direct, document.createElement('br'))
const host = document.createElement('div')
probe.append(host)
document.body.append(probe)
const shadow = host.attachShadow({ mode: 'closed' })
const nested = direct.cloneNode(true)
nested.href = 'https://example.org/utags-shadow'
nested.textContent = 'UTags closed Shadow DOM probe'
shadow.append(nested)
console.log('MAIN interception active:', host.shadowRoot !== null)
```

Expect `MAIN interception active: true` and working tags for both links. Remove
the probe by reloading the page. For iframe coverage, repeat this probe in the
page-console context of an HTTP(S) iframe whose origin you have also permitted;
`about:blank` and `srcdoc` are not promised by the current manifest. Existing
challenge-frame exclusions stay in place.

## Official references

- [Plasmo build targets](https://docs.plasmo.com/framework/workflows/build).
- [Plasmo 0.90.5 MAIN world registration](https://github.com/PlasmoHQ/plasmo/blob/v0.90.5/cli/plasmo/src/features/background-service-worker/bgsw-main-world-script.ts).
- [Apple Safari API compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility).
- [Apple Safari packaging](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari).
- [Apple running a Safari web extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension).
- [Apple account and Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account).
- [WebKit Safari 18.4 temporary extension loading](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/).
