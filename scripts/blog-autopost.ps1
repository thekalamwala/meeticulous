# blog-autopost.ps1 — headless daily blog publisher (Book A Sloth)
# Run by Windows Task Scheduler. Runs the whole pipeline inside a DEDICATED git
# worktree so the scheduled job never shares a branch with an interactive/peer
# Claude session (that collision landed a commit on the wrong branch during the
# build). The worktree lives OUTSIDE OneDrive (no sync-revert hazard), reuses the
# main checkout's node_modules via junctions, and gets the .env files copied in.
#
#   powershell -ExecutionPolicy Bypass -File scripts\blog-autopost.ps1 -Mode marketing
#   powershell -ExecutionPolicy Bypass -File scripts\blog-autopost.ps1 -Mode recap
#
# Fully autonomous: --dangerously-skip-permissions lets the run merge blog PRs and
# seed both DBs without prompts. The /blog-autopost quality gate + the blog-only-
# diff scope check are the guardrails (see .claude/skills/blog-autopost).

param(
  [ValidateSet('marketing','recap')]
  [string]$Mode = 'marketing'
)

$ErrorActionPreference = 'Stop'
$MainRepo = Split-Path -Parent $PSScriptRoot            # repo root (scripts/ -> ..)
$WT       = Join-Path $env:LOCALAPPDATA 'bas-autopost-worktree'
$Branch   = 'autopost-runner'

$log = Join-Path $MainRepo 'scratch\blog-autopost-runner.log'
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
function Log($m) { "$([DateTime]::Now.ToString('s'))  $m" | Tee-Object -FilePath $log -Append }

Log "=== run start: mode=$Mode ==="

# --- Ensure the dedicated worktree exists (created once, reused after) ---------
if (-not (Test-Path (Join-Path $WT '.git'))) {
  Log "creating worktree at $WT"
  git -C $MainRepo fetch origin --quiet
  git -C $MainRepo worktree add -B $Branch $WT origin/main
}

# --- Link node_modules (gitignored, not in a worktree) via junctions -----------
foreach ($d in @('client', 'server')) {
  $dst = Join-Path $WT "$d\node_modules"
  $src = Join-Path $MainRepo "$d\node_modules"
  if ((Test-Path $src) -and -not (Test-Path $dst)) {
    # ponytail: junction (not copy) — shares the main checkout's installed deps.
    cmd /c mklink /J "`"$dst`"" "`"$src`"" | Out-Null
    Log "junctioned $d/node_modules"
  }
}

# --- Copy env files (gitignored) so scoring + seedBlogs work in the worktree ----
foreach ($e in @('server\.env', 'server\.env.staging', 'client\.env')) {
  $src = Join-Path $MainRepo $e
  $dst = Join-Path $WT $e
  if (Test-Path $src) { Copy-Item $src $dst -Force }
}

# --- Sync the worktree to current origin/main (no 'main' checkout — that branch
#     is held by the main repo; a worktree cannot check it out) -----------------
Set-Location $WT
git fetch origin --quiet
$dirty = git status --porcelain
if ($dirty) { Log "ABORT: worktree not clean:`n$dirty"; exit 1 }
git reset --hard origin/main --quiet
git checkout -B $Branch --quiet
Log "worktree on $Branch @ $(git rev-parse --short HEAD)"

# --- Hand off to Claude headless -----------------------------------------------
$prompt = "/blog-autopost $Mode"
claude -p $prompt --dangerously-skip-permissions 2>&1 | Tee-Object -FilePath $log -Append
$code = $LASTEXITCODE
Log "=== run end: exit=$code ==="
exit $code
