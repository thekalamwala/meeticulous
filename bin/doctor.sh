#!/usr/bin/env bash
# doctor.sh — read-only Windows host preflight for Paperclip agents (ASH-90, guardrail #8).
# Catches the two silent host failures before they bite:
#   1. Developer Mode OFF  → EPERM materialising skill symlinks (ARTHA/SATYA on `complain`).
#   2. Repo/install under OneDrive → esbuild EBADPLATFORM lockfile drift (CI #257).
# Read-only (registry + string checks). Exit 1 on any failure, printing the exact fix.
# Usage: bash bin/doctor.sh [path]   (path defaults to the current directory)
set -uo pipefail

FAIL=0
bad() { echo "FAIL: $1"; echo "   fix: $2"; FAIL=1; }
ok()  { echo "ok:   $1"; }

# 1. Developer Mode ON — skill symlinks need it, else EPERM without elevation.
# Read via PowerShell: in Git Bash `reg query` mangles the HKLM\... key (MSYS path
# conversion). The host is Windows by definition; skip cleanly if run elsewhere.
if command -v powershell >/dev/null 2>&1; then
  val="$(powershell -NoProfile -Command "(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock' -Name AllowDevelopmentWithoutDevLicense -ErrorAction SilentlyContinue).AllowDevelopmentWithoutDevLicense" 2>/dev/null | tr -d '[:space:]')"
  if [ "$val" = "1" ]; then
    ok "Developer Mode is ON"
  else
    bad "Developer Mode is OFF (AllowDevelopmentWithoutDevLicense=${val:-unset})" \
        "Settings → System → For developers → Developer Mode ON  (or run: start ms-settings:developers)"
  fi
else
  echo "skip: Developer Mode check — no powershell (not a Windows host)"
fi

# 2. Repo/install path outside OneDrive — OneDrive sync corrupts node_modules + esbuild.
path="${1:-$PWD}"
case "$(printf '%s' "$path" | tr 'A-Z' 'a-z')" in
  *onedrive*) bad "path is under OneDrive: $path" \
                  "clone + 'npm ci' outside OneDrive (e.g. C:/dev/<repo>); OneDrive file sync corrupts node_modules and breaks esbuild (EBADPLATFORM)" ;;
  *)          ok "path is outside OneDrive: $path" ;;
esac

if [ "$FAIL" = 0 ]; then
  echo "host preflight: PASS"
else
  echo "host preflight: FAIL — fix the item(s) above before running agents here."
  exit 1
fi
