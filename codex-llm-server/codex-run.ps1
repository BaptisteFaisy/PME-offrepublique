# codex-run.ps1 — RUN a Codex agent AS a specific account, THROUGH that account's
# remembered proxy. The run-time companion to codex-login.ps1.
#
#   .\codex-run.ps1 1 [args...]   # compte 1 = PERSO -> ~/.codex
#   .\codex-run.ps1 2 [args...]   # compte 2 = DCE   -> ~/.codex-dce
#
# Everything after the account number is passed straight to `codex`, e.g.:
#   .\codex-run.ps1 2 exec "resume ce doc"
#   .\codex-run.ps1 1                       # TUI interactif en compte perso
#
# WHAT IT DOES (for THIS process only, restored on exit — your shell stays clean):
#   * pins CODEX_HOME to the chosen account's home (so codex runs AS that account),
#   * reads that account's remembered proxy (<home>/proxy.txt, written by
#     codex-login.ps1 -Proxy) and sets HTTP_PROXY/HTTPS_PROXY/ALL_PROXY,
#   * FAIL-CLOSED: if the account is flagged 'proxy required' (<home>/proxy.require)
#     and no proxy is resolved, it REFUSES to run (exit 3) so the real IP can never
#     leak during the agent's traffic.
#
# Because env vars are per-process, two terminals — `codex-run 1` and
# `codex-run 2` — run two agents with different accounts AND different proxies at
# the same time, with no conflict.
#
# ASCII-only output on purpose (a BOM-less .ps1 is read as ANSI by PS 5.1).

[CmdletBinding()]
param(
  [Parameter(Mandatory, Position = 0)]
  [ValidateSet('1', '2', '3')]
  [string]$Account,
  # Everything else -> forwarded verbatim to `codex`.
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$CodexArgs
)

# --- account map: keep in sync with codex-login.ps1 --------------------------
$accounts = @{
  '1' = [pscustomobject]@{ Label = 'PERSO'; Email = 'baptiste.faisy@gmail.com';      Home = (Join-Path $HOME '.codex') }
  '2' = [pscustomobject]@{ Label = 'DCE';   Email = 'loofahs_68_risible@icloud.com'; Home = (Join-Path $HOME '.codex-dce') }
  '3' = [pscustomobject]@{ Label = 'TEST';  Email = '';                              Home = (Join-Path $HOME '.codex-3') }
}
$sel = $accounts[$Account]

function Info($m) { Write-Host "[ .. ] $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "[ OK ] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "[FAIL] $m" -ForegroundColor Red }

# Resolve the REAL codex executable (not a function/alias of the same name).
$codex = (Get-Command codex -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $codex) {
  Fail "codex CLI introuvable sur le PATH."
  exit 1
}

if (-not (Test-Path $sel.Home)) {
  Fail ("Home du compte " + $Account + " introuvable: " + $sel.Home + "  (fais d'abord: codex-login " + $Account + ")")
  exit 1
}

# --- resolve this account's remembered proxy + mandatory-proxy flag -----------
$proxyFile   = Join-Path $sel.Home 'proxy.txt'
$requireFile = Join-Path $sel.Home 'proxy.require'
$effProxy    = $null
if (Test-Path $proxyFile) {
  # 1re ligne non-commentaire (#) = l'URL (proxy.txt tolere un bloc explicatif en tete).
  $saved = Get-Content $proxyFile | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') } | Select-Object -First 1
  if ($saved) { $effProxy = $saved.Trim() }
}
$proxyRequired = Test-Path $requireFile

# Fail-closed: never run without a proxy for an account that requires one.
if ($proxyRequired -and -not $effProxy) {
  Fail ("Compte " + $Account + " marque 'proxy obligatoire' mais aucun proxy memorise -> execution refusee (pas de fuite d'IP).")
  Warn ("=> Definis-le d'abord:  codex-login " + $Account + " -Proxy <url>   (ou leve l'exigence avec -ClearProxy).")
  exit 3
}

Info ("Compte $Account = " + $sel.Label + "  ->  home: " + $sel.Home)
if ($effProxy)  { Info ("Proxy (compte " + $Account + "): " + $effProxy) }
else            { Warn "Aucun proxy pour ce compte -> trafic en DIRECT (IP reelle visible)." }

# --- run codex with CODEX_HOME + proxy pinned for THIS process only ----------
$prevHome  = $env:CODEX_HOME
$prevProxy = @{ HTTP_PROXY = $env:HTTP_PROXY; HTTPS_PROXY = $env:HTTPS_PROXY; ALL_PROXY = $env:ALL_PROXY }
try {
  $env:CODEX_HOME = $sel.Home
  if ($effProxy) {
    $env:HTTP_PROXY  = $effProxy
    $env:HTTPS_PROXY = $effProxy
    $env:ALL_PROXY   = $effProxy
  }

  if ($CodexArgs) { & $codex @CodexArgs }
  else            { & $codex }
  $exitCode = $LASTEXITCODE
}
finally {
  if ($null -eq $prevHome) { Remove-Item Env:\CODEX_HOME -ErrorAction SilentlyContinue }
  else { $env:CODEX_HOME = $prevHome }
  foreach ($k in @('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY')) {
    if ($null -eq $prevProxy[$k]) { Remove-Item ("Env:\" + $k) -ErrorAction SilentlyContinue }
    else { Set-Item ("Env:\" + $k) $prevProxy[$k] }
  }
}

exit $exitCode
