#!/bin/sh
# Point git at the committed hooks. Run once per clone. Idempotent.
set -e
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true
echo "Hooks installed: core.hooksPath -> .githooks (pre-push runs the CI suite locally)."
