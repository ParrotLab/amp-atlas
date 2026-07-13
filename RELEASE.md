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
   - Loads `app/.env`, builds, signs with your Developer ID cert, **notarizes** with Apple, **pre-creates the GitHub release** for the tag (`release:tag`), then **publishes** the artifacts (`.dmg` + `.zip` + `latest-mac.yml`) to `amp-atlas-releases`.
   - _Why the pre-create step:_ electron-builder v26 spins up one publisher per target (`dmg` + `zip`) and they race to **create** the release, which GitHub rejects with `422 "Published releases must have a valid tag."` Pre-creating the release (idempotent — `|| true` if it already exists) means both publishers just find it and upload. Requires the `gh` CLI to be installed and authed.
3. **First install:** hand each user the `.dmg` directly (Slack/Drive). They drag it to Applications.
4. **After that:** users auto-update — on launch the app checks the releases repo, downloads a newer version, and prompts to restart.

## Notes
- The `.zip` artifact is required for auto-update (don't remove the `zip` target).
- Notarization can take a few minutes; electron-builder waits for it.
- If a build fails on signing/notarization, check the cert is in the keychain and the Apple env vars in `app/.env` are correct.
