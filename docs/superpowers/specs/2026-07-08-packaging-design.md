# Design: macOS Packaging + Auto-update

**Date:** 2026-07-08
**Status:** Approved (pending written-spec review)
**Workstream:** MVP #1 — see [`docs/mvp-planning.md`](../../mvp-planning.md) §3 and the roadmap.
**Branch:** `feat/packaging`

## Background

The app only runs via `npm run dev`. To ship to the 6 non-technical pilot users it needs a **signed, notarized, double-click `.dmg`** and **silent auto-updates** (`mvp-planning.md` §3). This workstream adds the electron-builder packaging + electron-updater pipeline and a one-command local release. No product features change.

## Decisions (all confirmed)

- **Build locally** on Kristi's Mac (`npm run release`) — not CI. Signs with the Developer ID cert in her keychain, notarizes with her Apple creds, publishes to GitHub Releases.
- **Releases live in a dedicated private repo** `ParrotLab/amp-atlas-releases` (built binaries only, no source).
- **Auto-updater authenticates with an embedded read-only token** (`AMP_UPDATER_TOKEN`), scoped to `amp-atlas-releases` (Contents: read). Inlined at build time; read-only + binaries-only repo = minimal blast radius. Users need no repo access.
- macOS only. App id **`com.parrotlabs.amp-up`**, product name **AMP Atlas**.

**Environment already in place:** Developer ID Application cert in keychain (Team `5QCNM58567`); `app/.env` (gitignored) holds `AMP_UPDATER_TOKEN`, `GH_TOKEN` (write, publish), `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`; `app/build/icon.png` (1024×1024).

---

## 1. Dependencies

- Add **runtime:** `electron-updater`.
- Add **dev:** `electron-builder`, `@electron/notarize`, `dotenv-cli`.
- Move `electron-vite` to **devDependencies** (build-only; avoids packaging it).
- (Renderer libs like `@tiptap/*`/`react` stay in `dependencies` — they're bundled into `out/renderer` by Vite, harmless if also present in node_modules. Dependency pruning is a possible later size optimization, not required.)

## 2. `electron-builder.yml`

At `app/electron-builder.yml`:
- `appId: com.parrotlabs.amp-up`, `productName: AMP Atlas`.
- `directories: { output: dist, buildResources: build }`.
- `files: ['out/**/*', 'package.json']` (the electron-vite build output).
- `mac`: `target: [dmg, zip]` (zip is **required** for auto-update), `category: public.app-category.productivity`, `icon: build/icon.png`, `hardenedRuntime: true`, `gatekeeperAssess: false`, `entitlements: build/entitlements.mac.plist`, `entitlementsInherit: build/entitlements.mac.plist`, `notarize: { teamId: 5QCNM58567 }` (electron-builder reads `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` from env).
- `publish: { provider: github, owner: ParrotLab, repo: amp-atlas-releases, private: true, releaseType: release }`.

## 3. `build/entitlements.mac.plist`

Standard hardened-runtime entitlements Electron needs: `com.apple.security.cs.allow-jit`, `allow-unsigned-executable-memory`, `allow-dyld-environment-variables`, `disable-library-validation`.

## 4. Embedded updater token (build-time inlining)

In `electron.vite.config.ts`, the **main** config gets a `define` that inlines the token from the build env:
```
define: { 'process.env.AMP_UPDATER_TOKEN': JSON.stringify(process.env.AMP_UPDATER_TOKEN || '') }
```
So the release build (run through `dotenv-cli`) bakes the read-only token into the main bundle. In dev it's empty (updater doesn't run in dev anyway).

## 5. Auto-update wiring — `src/main/updater.ts`

`setupAutoUpdate(mainWindow)` called from `index.ts` on `app.whenReady`, **only when `app.isPackaged`** (never in dev):
- `import { autoUpdater } from 'electron-updater'`.
- Authenticate the private feed: `autoUpdater.requestHeaders = { authorization: \`token ${process.env.AMP_UPDATER_TOKEN}\` }` (the inlined read-only token).
- `autoUpdater.autoDownload = true`; `autoUpdater.checkForUpdates()` on launch (and optionally every few hours).
- On `update-downloaded`: show a small dialog — *"A new version of AMP Atlas is ready. Restart to update?"* → **Restart** calls `autoUpdater.quitAndInstall()`, **Later** dismisses (installs on next quit).
- On `error`: log quietly (don't interrupt the user); update retries next launch.

`app-update.yml` (the feed config) is generated into the app by electron-builder from the `publish` block.

## 6. Release process — `npm run release`

`package.json` scripts:
- `"release": "dotenv -e .env -- npm run release:build"`
- `"release:build": "electron-vite build && electron-builder --mac --publish always"`

`dotenv-cli` loads `app/.env` so `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID` (notarize), `GH_TOKEN` (publish), and `AMP_UPDATER_TOKEN` (inlined) are present. One command: build → sign → notarize → publish a GitHub Release to `amp-atlas-releases` with `.dmg`, `.zip`, and `latest-mac.yml`.

**Versioning:** bump `version` in `app/package.json` before each release (the updater compares versions). First release `1.0.0`; test auto-update by cutting `1.0.1`.

## 7. `RELEASE.md`

At repo root: documents the one-time setup (cert, repo, tokens, `.env`, icon — mostly done) and the per-release steps (bump version → `npm run release` → users get it via auto-update; hand the first `.dmg` to each user directly).

## 8. Error handling

- Missing Apple creds / cert → electron-builder fails loudly at build with a clear message (Kristi's build machine only).
- Updater 401 (bad/expired embedded token) or network error → logged, non-fatal, retries next launch. Never blocks app use.
- Unsigned/blocked download for a user → they still have a working installed app; the update just doesn't apply until fixed.

## 9. Testing

- **Automated (I can run):** an **unsigned `--dir` build** (`CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --dir`) to prove the electron-builder config + entitlements + icon produce a valid `.app` bundle without needing certs. Plus `npm test` / `tsc` / `npm run build` stay green, and the app still boots in dev (updater is skipped when not packaged).
- **Manual (Kristi only — needs certs + Apple creds + network):** `npm run release` produces a signed, notarized `.dmg` + published GitHub Release; install the `.dmg`; then bump to `1.0.1`, release again, and confirm the running app **auto-updates**.

## Affected files (indicative)

- **New:** `app/electron-builder.yml`, `app/build/entitlements.mac.plist`, `app/src/main/updater.ts`, `RELEASE.md`. (`app/build/icon.png` already added.)
- **Modify:** `app/package.json` (deps + `release`/`release:build` scripts), `app/electron.vite.config.ts` (`define` the updater token for main), `app/src/main/index.ts` (call `setupAutoUpdate` when packaged).

## Success criteria

1. `npm run release` on Kristi's Mac produces a **signed + notarized** `.dmg` (+ `.zip` + `latest-mac.yml`) and publishes a GitHub Release to `ParrotLab/amp-atlas-releases`.
2. Installing the `.dmg` gives a **double-click app with no Gatekeeper warning** and the AMP Atlas icon.
3. Cutting a higher version and releasing again causes the installed app to **auto-update** (prompt to restart), with **no repo access needed by the user**.
4. The embedded token is **read-only** and scoped to the binaries-only repo.
5. Dev/test unaffected: `npm run dev` works, the updater is skipped when not packaged, tests/build stay green, and an unsigned `--dir` build succeeds.
