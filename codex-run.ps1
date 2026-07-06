# codex-run.ps1 (repo root) — thin FORWARDER to codex-llm-server\codex-run.ps1.
#
# Run a Codex agent as a specific account, through that account's remembered
# proxy, WITHOUT `cd codex-llm-server`:
#   .\codex-run.ps1 1 [args...]   # compte perso -> ~/.codex
#   .\codex-run.ps1 2 [args...]   # compte DCE   -> ~/.codex-dce
#
# ASCII-only on purpose (a BOM-less .ps1 is read as ANSI by PS 5.1).

$real = Join-Path $PSScriptRoot 'codex-llm-server\codex-run.ps1'
if (-not (Test-Path $real)) {
  Write-Host "[FAIL] Introuvable: $real" -ForegroundColor Red
  exit 1
}

& $real @args
exit $LASTEXITCODE
