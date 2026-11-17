# Host preflight (Windows) — Paperclip agents & local dev

Two host settings cause **silent** failures if wrong. `bin/doctor.sh` checks both, read-only.

```bash
bash bin/doctor.sh            # checks the current directory
bash bin/doctor.sh C:/dev/x   # checks a specific path
```
Exit 0 = PASS. Exit 1 = a requirement below is unmet (the exact fix is printed).

## 1. Developer Mode ON
Windows requires Developer Mode to create symlinks without elevation. With it OFF, materialising a skill errors with `EPERM: operation not permitted, symlink` (this is what broke ARTHA/SATYA on the `complain` skill).

Fix: **Settings → System → For developers → Developer Mode = ON** (or run `start ms-settings:developers`). The doctor reads `HKLM\…\AppModelUnlock\AllowDevelopmentWithoutDevLicense` (must be `1`).

## 2. Repo / install path OUTSIDE OneDrive
OneDrive's file sync corrupts `node_modules` and desyncs the esbuild platform binary from the lockfile → `EBADPLATFORM` on `npm ci` (this broke CI #257). Clone and `npm ci` somewhere OneDrive doesn't sync, e.g. `C:/dev/<repo>`.

> Note: the founder's primary checkout currently lives under OneDrive — a known hazard. When installing deps for CI-parity work, do it in a non-OneDrive copy.

## Enforcement
`doctor.sh` is read-only and host-level, so it is **not** wired into the ubuntu CI (the checks are meaningless there). Run it on the Windows agent host — manually, or via a Paperclip agent startup/preflight hook if one is exposed.
