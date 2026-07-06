# refresh-dce.ps1 — refresh ONLY the DCE Codex account, isolated from perso.
#
# WHY THIS EXISTS
#   The DCE server borrows a DEDICATED ChatGPT account (loofahs_...@icloud.com),
#   kept in its OWN Codex home: ~/.codex-dce. Your PERSONAL account
#   (baptiste.faisy@gmail.com) lives in the default home ~/.codex and powers your
#   local agents + the Codex desktop app.
#
#   `codex login` always writes to whatever $env:CODEX_HOME points at (default
#   ~/.codex). So refreshing the DCE login WITHOUT pinning CODEX_HOME silently
#   overwrites your PERSONAL ~/.codex with the DCE account — which is exactly what
#   kept breaking the two-account separation.
#
#   This wrapper PINS $env:CODEX_HOME to ~/.codex-dce for its own process only,
#   then delegates to refresh-codex-auth.ps1. Result: the DCE refresh can NEVER
#   touch ~/.codex (perso).
#
# USAGE
#   ./refresh-dce.ps1             # login (DCE account) into ~/.codex-dce + push to Railway
#   ./refresh-dce.ps1 -SkipLogin  # DCE auth already fresh -> just push
#   ./refresh-dce.ps1 -DryRun     # validate only, do not push
#   ./refresh-dce.ps1 -Service my-svc
#
# MULTI-ACCOUNT (failover): each extra ChatGPT account is a SEPARATE
# codex-llm-server service with its OWN isolated Codex home. Use -Slot to pick it:
#   ./refresh-dce.ps1 -Slot b -Service codex-llm-server-b
#     -> logs the 2nd account into ~/.codex-dce-b and pushes to that service.
# Auto-detection is DISABLED once several services share Root Directory
# 'codex-llm-server', so -Service is REQUIRED with -Slot (the script enforces it).
# The web app lists every service's URL in DCE_LLM_BASE_URLS to fail over on 429.
#
# IMPORTANT: in the browser, sign in with the DCE account for THIS slot
#   (the default slot uses loofahs_...@icloud.com) — NOT your personal account.
#
# NOTE: intentionally does NOT set $ErrorActionPreference='Stop' — the delegated
# script relies on the default so the railway/codex .ps1 shims' stderr does not
# abort it (see the note in refresh-codex-auth.ps1). ASCII-only output on purpose.

[CmdletBinding()]
param(
  [string]$Service,        # empty => auto-detect (same as refresh-codex-auth.ps1)
  [string]$Environment,
  [string]$Slot,           # empty => default account (~/.codex-dce); e.g. 'b' => ~/.codex-dce-b
  [switch]$SkipLogin,
  [switch]$DryRun
)

# A non-default slot isolates an extra ChatGPT account in its own Codex home.
# Because several codex-llm-server services then share the same Root Directory,
# auto-detection can't tell them apart -- so -Service is mandatory with -Slot.
$slotSuffix = if ($Slot) { '-' + ($Slot.Trim().ToLower()) } else { '' }
if ($Slot -and [string]::IsNullOrWhiteSpace($Service)) {
  Write-Host "[FAIL] -Slot '$Slot' exige -Service <nom> (auto-detection impossible avec plusieurs services codex-llm-server)." -ForegroundColor Red
  exit 1
}

$DceHome = Join-Path $HOME (".codex-dce$slotSuffix")
$DceAuth = Join-Path $DceHome 'auth.json'

if (-not (Test-Path $DceHome)) {
  New-Item -ItemType Directory -Path $DceHome -Force | Out-Null
  Write-Host "[ .. ] Home DCE cree: $DceHome" -ForegroundColor Cyan
}

# Pin EVERY codex operation (login + read) to the DCE home for THIS process only.
$env:CODEX_HOME = $DceHome
Write-Host "[ .. ] CODEX_HOME epingle sur: $DceHome" -ForegroundColor Cyan
if (-not $SkipLogin) {
  $acct = if ($Slot) { "le compte DCE du slot '$Slot'" } else { "le compte DCE (loofahs_...@icloud.com)" }
  Write-Host "[WARN] Dans le navigateur, connecte-toi avec $acct, PAS ton compte perso." -ForegroundColor Yellow
}

$main = Join-Path $PSScriptRoot 'refresh-codex-auth.ps1'
if (-not (Test-Path $main)) {
  Write-Host "[FAIL] Introuvable: $main (lance ce script depuis codex-llm-server/)." -ForegroundColor Red
  exit 1
}

# Delegate. -AuthPath forces validation to read the DCE home; CODEX_HOME (above)
# forces the login itself to write there too.
$fwd = @{ AuthPath = $DceAuth }
if ($Service)     { $fwd.Service     = $Service }
if ($Environment) { $fwd.Environment = $Environment }
if ($SkipLogin)   { $fwd.SkipLogin   = $true }
if ($DryRun)      { $fwd.DryRun       = $true }

& $main @fwd
exit $LASTEXITCODE
