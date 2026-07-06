# codex-login.ps1 (repo root) — thin FORWARDER.
#
# Lets you run the Codex login from the repo root WITHOUT `cd codex-llm-server`.
# It just relays every argument to codex-llm-server\codex-login.ps1 (the real
# script, where all the logic + options live), and returns its exit code.
#
# Examples (identical to the real script's options):
#   .\codex-login.ps1 2
#   .\codex-login.ps1 2 -Proxy http://127.0.0.1:8080 -RequireProxy
#   .\codex-login.ps1 2 -ClearProxy
#   .\codex-login.ps1 2 -DeviceAuth
#
# ASCII-only on purpose (a BOM-less .ps1 is read as ANSI by PS 5.1).

$real = Join-Path $PSScriptRoot 'codex-llm-server\codex-login.ps1'
if (-not (Test-Path $real)) {
  Write-Host "[FAIL] Introuvable: $real" -ForegroundColor Red
  Write-Host "       Lance ce forwarder depuis la racine du repo (ou utilise le vrai script)." -ForegroundColor Yellow
  exit 1
}

# Splat every received argument (positional + named) straight through.
& $real @args
exit $LASTEXITCODE
