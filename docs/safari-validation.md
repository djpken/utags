# Safari validation record

## Environment

- Date: 2026-10-12.
- Build host: Linux CloudStack VM; Node.js 26.7.0 and pnpm 10.6.2.
- Plasmo: 0.90.5. The lockfile adds the matching extension coverage provider.
- Target: `safari-mv3`; Safari/iOS 16.4 API baseline.
- macOS, Xcode, Safari, iPhone, Apple provisioning: unavailable on this host.

## Automated checks

| Check | Result |
| --- | --- |
| Baseline extension tests | Passed: 385 tests in 14 files. |
| Baseline Chrome build and extension type check | Passed before changes. |
| Extension tests after Safari changes | Passed: 405 tests in 18 files. |
| Safari build/package helper tests | Passed: 18 tests. Xcode execution is mocked; these are not macOS packaging results. |
| Safari build and resource validation | Passed: background, popup, content scripts, MAIN injection and referenced files validated. |
| Safari ZIP | Passed: 13 ZIP entries; integrity check and extracted-resource validation passed. |
| Chrome build | Passed after shared-code changes. |
| Firefox MV2 and MV3 build | Passed; addons-linter reports 0 errors and 18 warnings per target in bundled dependencies. |
| Userscript production variants | Passed: standard, no-adult, and full production variants; generated JavaScript passes syntax checks. Builds ran in an isolated temporary directory to leave committed userscript artifacts unchanged. |
| Safari validator/project helper coverage | Passed: 95.81% lines, 83.61% branches, 100% functions using Node test coverage. |
| New runtime helper/modal coverage | Passed: 92.85% statements/lines, 85.18% branches, 90% functions. Each covered file meets 80%. |
| Extension type check and lint | Passed: extension type check and full read-only XO lint; 40 pre-existing warnings remain; no new lint warnings. |

Safari-specific tests cover extension target routing, settings messaging,
background HTTP success/failure/timeout, visible-viewport modal resizing and
listener cleanup, package resource validation, tool-name fallback, unsupported
platforms/options, and existing-output protection.

The initial Firefox MV2 build failed because its manifest script also opened a
nonexistent Firefox MV3 manifest. The script now accepts the current manifest
path; independent builds no longer require an earlier build of the other
target. The first Safari resource check also found Plasmo's phantom accessible
CSS entries for inlined `data-text` imports. Cleanup removes only absent,
unreferenced generated content CSS while preserving real resource references.

The initial coverage run failed because Vitest 4.1.2 loaded the workspace
coverage provider 4.0.18 from its own native-import context. The extension now
declares provider 4.1.2 and resolves its local provider explicitly in the
Vitest config. `test:safari-coverage` reproduces the check and enforces 80%
per-file thresholds for the new environment/messaging helpers and modal.

The Safari CI workflow is configured but has not run on GitHub in this session.

Final Safari archive: `packages/extension/build/safari-mv3-prod.zip`,
257,509 bytes, 13 entries. Integrity, extracted-resource validation, and
byte-for-byte comparison with the build directory passed.

SHA-256: `b43ef743b0d7e7ec46d7d53298b2b1f5feed9360a8c75572a27b2fb7ee0e5910`.

## Device acceptance

| Stage | Status | Required evidence |
| --- | --- | --- |
| macOS Xcode project generation/build | Pending on a Mac | Xcode/tool version, warnings, scheme and build result. |
| macOS Safari acceptance | Pending on a Mac | Safari/macOS versions and all desktop cases in the development guide. |
| Free-account iPhone signing | Pending on a Mac | Success or sanitized provisioning/capability error. |
| iPhone Safari acceptance | Pending signing | Device/iOS version and touch, sync, restart/update results. |
| Safari/iOS 16.4 minimum-version execution | Not tested | Actual device/browser results before advertising verified minimum-version support. |

Use [the development guide](safari-development.md) for commands and acceptance
cases. Linux builds, unit tests, and mocked Xcode calls do not establish Safari
runtime compatibility or successful free-account installation.
