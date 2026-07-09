# macOS Packaging + Auto-update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the app into a signed + notarized macOS `.dmg` with silent auto-updates, produced by one local command (`npm run release`) and published to the private `ParrotLab/amp-atlas-releases` repo.

**Architecture:** electron-builder packages/signs/notarizes and publishes; electron-updater checks the private releases repo using an embedded read-only token (inlined at build via electron-vite `define`); the updater runs only in the packaged app. Setup (cert, releases repo, tokens, icon, `app/.env`) is already in place.

**Tech Stack:** electron-builder, electron-updater, @electron/notarize, dotenv-cli.

**Spec:** `docs/superpowers/specs/2026-07-08-packaging-design.md` · **Releases repo:** `ParrotLab/amp-atlas-releases` · **Team ID:** `5QCNM58567`

**Note:** this workstream is config, not TDD — verification is typecheck + build + an unsigned packaging dry-run (the real signed/notarized/published build is Kristi's to run). Commands run from `app/`; `git` from repo root (`cd ..`).

---

## Task 1: Dependencies

**Files:** Modify `app/package.json`

- [ ] **Step 1: Install**

Run:
```
cd app && npm install electron-updater && npm install -D electron-builder @electron/notarize dotenv-cli
```
Expected: added, no errors.

- [ ] **Step 2: Move `electron-vite` to devDependencies**

In `app/package.json`, remove `"electron-vite": "^5.0.0",` from `"dependencies"` and add it to `"devDependencies"` (build-only tool). Leave all other deps as-is.

- [ ] **Step 3: Verify install + dev deps**

Run: `cd app && npm ls electron-builder electron-updater @electron/notarize dotenv-cli 2>/dev/null | grep -E "electron-builder|electron-updater|notarize|dotenv-cli"`
Expected: all four listed.

- [ ] **Step 4: Commit**

```bash
cd .. && git add app/package.json app/package-lock.json && git commit -m "build: add electron-builder/updater/notarize/dotenv deps"
```

## Task 2: `electron-builder.yml`

**Files:** Create `app/electron-builder.yml`

- [ ] **Step 1: Create the config**

Create `app/electron-builder.yml`:

```yaml
appId: com.parrotlabs.amp-up
productName: AMP Atlas
directories:
  output: dist
  buildResources: build
files:
  - out/**/*
  - package.json
mac:
  target:
    - dmg
    - zip
  category: public.app-category.productivity
  icon: build/icon.png
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  notarize:
    teamId: 5QCNM58567
publish:
  provider: github
  owner: ParrotLab
  repo: amp-atlas-releases
  private: true
  releaseType: release
```

- [ ] **Step 2: Commit**

```bash
cd .. && git add app/electron-builder.yml && git commit -m "build: electron-builder config (mac dmg+zip, notarize, private publish)"
```

## Task 3: Hardened-runtime entitlements

**Files:** Create `app/build/entitlements.mac.plist`

- [ ] **Step 1: Create the entitlements**

Create `app/build/entitlements.mac.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

- [ ] **Step 2: Commit**

```bash
cd .. && git add app/build/entitlements.mac.plist && git commit -m "build: hardened-runtime entitlements for macOS"
```

## Task 4: Inline the updater token (electron-vite `define`)

**Files:** Modify `app/electron.vite.config.ts`

- [ ] **Step 1: Add `define` to the main config**

Replace the `main` block in `app/electron.vite.config.ts`:

```typescript
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      'process.env.AMP_UPDATER_TOKEN': JSON.stringify(process.env.AMP_UPDATER_TOKEN || '')
    }
  },
```

- [ ] **Step 2: Verify build still works**

Run: `cd app && npm run build`
Expected: build succeeds (token inlines as an empty string in a normal dev build).

- [ ] **Step 3: Commit**

```bash
cd .. && git add app/electron.vite.config.ts && git commit -m "build: inline AMP_UPDATER_TOKEN into the main bundle at build time"
```

## Task 5: Auto-update wiring

**Files:** Create `app/src/main/updater.ts`; Modify `app/src/main/index.ts`

- [ ] **Step 1: Create the updater module**

Create `app/src/main/updater.ts`:

```typescript
import { app, dialog, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

/** Wire auto-updates. Only meaningful in a packaged build. */
export function setupAutoUpdate(win: BrowserWindow | null): void {
  if (!app.isPackaged) return // never in dev

  // Authenticate to the private releases repo with the embedded read-only token.
  const token = process.env.AMP_UPDATER_TOKEN
  if (token) autoUpdater.requestHeaders = { authorization: `token ${token}` }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox(win!, {
      type: 'info',
      buttons: ['Restart', 'Later'],
      defaultId: 0,
      title: 'Update ready',
      message: 'A new version of AMP Atlas is ready.',
      detail: 'Restart to update now, or it will install the next time you quit.',
    })
    if (response === 0) autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', (err) => {
    // Non-fatal: log and retry next launch; never interrupt the user.
    console.error('[updater]', err)
  })

  autoUpdater.checkForUpdates().catch(err => console.error('[updater] check failed', err))
}
```

- [ ] **Step 2: Call it from `index.ts`**

In `app/src/main/index.ts`, add the import near the others:

```typescript
import { setupAutoUpdate } from './updater'
```

In the `app.whenReady().then(() => { ... })` block, after `createWindow()`, add:

```typescript
  setupAutoUpdate(mainWindow)
```

(`mainWindow` is the module-level window ref added in the external-edit-sync work.)

- [ ] **Step 3: Typecheck + build**

Run: `cd app && npx tsc -p tsconfig.node.json --noEmit && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
cd .. && git add app/src/main/updater.ts app/src/main/index.ts && git commit -m "feat: auto-update wiring (packaged-only, private feed, restart prompt)"
```

## Task 6: Release scripts

**Files:** Modify `app/package.json`

- [ ] **Step 1: Add scripts**

In `app/package.json` `"scripts"`, add:

```json
"release": "dotenv -e .env -- npm run release:build",
"release:build": "electron-vite build && electron-builder --mac --publish always"
```

- [ ] **Step 2: Commit**

```bash
cd .. && git add app/package.json && git commit -m "build: npm run release (dotenv → build → sign/notarize/publish)"
```

## Task 7: `RELEASE.md`

**Files:** Create `RELEASE.md` (repo root)

- [ ] **Step 1: Write the release doc**

Create `RELEASE.md`:

```markdown
# Releasing AMP Atlas (macOS)

Signed, notarized `.dmg` + auto-update, built locally on a Mac.

## One-time setup (already done)
- Developer ID Application certificate in the login keychain (Team `5QCNM58567`).
- Private repo `ParrotLab/amp-atlas-releases` (holds built binaries only).
- `app/.env` (gitignored) with:
  - `AMP_UPDATER_TOKEN` — fine-grained **read-only** PAT on `amp-atlas-releases` (Contents: read). Embedded in the app for auto-update.
  - `GH_TOKEN` — fine-grained **write** PAT on `amp-atlas-releases` (Contents: read/write). Publishes the release. Never embedded.
  - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` — for notarization.
- `app/build/icon.png` (1024×1024).

## To cut a release
1. Bump `version` in `app/package.json` (e.g. `1.0.0` → `1.0.1`). The updater compares versions.
2. From `app/`: `npm run release`
   - Loads `app/.env`, builds, signs with your Developer ID cert, **notarizes** with Apple, and **publishes** a GitHub Release (`.dmg` + `.zip` + `latest-mac.yml`) to `amp-atlas-releases`.
3. **First install:** hand each user the `.dmg` directly (Slack/Drive). They drag it to Applications.
4. **After that:** users auto-update — on launch the app checks the releases repo, downloads a newer version, and prompts to restart.

## Notes
- The `.zip` artifact is required for auto-update (don't remove the `zip` target).
- Notarization can take a few minutes; electron-builder waits for it.
- If a build fails on signing/notarization, check the cert is in the keychain and the Apple env vars in `app/.env` are correct.
```

- [ ] **Step 2: Commit**

```bash
cd .. && git add RELEASE.md && git commit -m "docs: RELEASE.md — local signed build + auto-update process"
```

## Task 8: Verification

- [ ] **Step 1: Green baseline**

Run: `cd app && npm test && npx tsc -p tsconfig.node.json --noEmit && npx tsc -p tsconfig.web.json --noEmit && npm run build`
Expected: tests pass, no type errors, build OK.

- [ ] **Step 2: Unsigned packaging dry-run (validates electron-builder config without certs)**

Run: `cd app && npm run build && CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --dir --mac -c electron-builder.yml 2>&1 | tail -20`
Expected: electron-builder produces an unsigned app bundle under `app/dist/mac*/AMP Atlas.app` (it may download the Electron dist the first time). This proves the config, entitlements, and icon are valid. (Signing/notarization/publish are intentionally skipped here.)

- [ ] **Step 3: Confirm the bundle exists**

Run: `ls -d "app/dist"/mac*/*.app 2>/dev/null && echo "app bundle built"`
Expected: prints the `.app` path.

- [ ] **Step 4: Dev still works (updater skipped when not packaged)**

Run: `cd app && (npm run dev > /tmp/pkg-dev.log 2>&1 &) ; sleep 12 ; grep -i "starting electron app" /tmp/pkg-dev.log && pkill -f electron-vite`
Expected: app boots; no updater errors (it's skipped because `app.isPackaged` is false in dev).

- [ ] **Step 5: Ensure `dist/` is gitignored**

Confirm the root `.gitignore` ignores `app/dist` (it does). Run: `git check-ignore app/dist && echo "dist ignored"`
Expected: `dist ignored`.

- [ ] **Step 6: Commit any touch-ups**

```bash
cd .. && git add -A && git commit -m "chore: packaging verified (config + unsigned dry-run)" || echo "nothing to commit"
```

- [ ] **Step 7: Hand off the real release to Kristi**

Kristi runs (needs certs + Apple creds + network):
1. Bump `version` in `app/package.json`.
2. `cd app && npm run release`.
3. Install the produced `.dmg`, confirm no Gatekeeper warning + correct icon.
4. Bump to a higher version, `npm run release` again, confirm the installed app auto-updates.

---

## Self-Review Notes (author)

- **Spec coverage:** deps §1 → T1; electron-builder.yml §2 → T2; entitlements §3 → T3; token inlining §4 → T4; updater wiring §5 → T5; release scripts §6 → T6; RELEASE.md §7 → T7; error handling §8 → T5 (updater `error`/non-fatal); testing §9 → T8 (unsigned dry-run + green baseline + dev boot). All covered.
- **No unit tests:** this is build config; verification is typecheck/build/dry-run, per the spec's testing note. Not a gap.
- **Consistency:** `AMP_UPDATER_TOKEN` inlined in T4 is read in T5; `electron-builder.yml` publish target matches RELEASE.md + spec; Team ID `5QCNM58567` consistent across config + docs.
- **Deferred (correctly out):** CI builds, dependency pruning for size, Windows.
```