# refresh-codex-auth.ps1 — recover the M1 LLM endpoint after a 401.
#
# The `codex-llm-server` service borrows your ChatGPT Codex session
# (~/.codex/auth.json, stored on Railway as CODEX_AUTH_JSON). When ChatGPT
# invalidates that session the DCE analysis fails with:
#     401 "Your authentication token has been invalidated. Please try signing in again."
#
# This script:
#   1. (optional) runs `codex login` to mint fresh tokens locally,
#   2. reads + validates ~/.codex/auth.json,
#   3. pushes it to CODEX_AUTH_JSON on the Railway service, which triggers a
#      redeploy so the server re-reads the token at boot.
#
# NOTE: `codex login` is an interactive browser OAuth flow and cannot be fully
# headless -- you finish it in the browser. Everything after it is automated.
#
# Usage:
#   ./refresh-codex-auth.ps1                 # full: login + auto-detect service + push
#   ./refresh-codex-auth.ps1 -SkipLogin      # auth.json already fresh -> just push
#   ./refresh-codex-auth.ps1 -DryRun         # detect + validate, but DON'T push
#   ./refresh-codex-auth.ps1 -Service my-svc # force a service name (skip auto-detect)
#
# By default the target service is AUTO-DETECTED: the Railway service in the
# linked project whose Root Directory is `codex-llm-server` (Railway assigns a
# random service name like "vivacious-compassion", so we never hard-code it).
#
# Prereqs: Railway CLI logged in (`railway login`) and this repo linked
# (`railway link`); the Codex CLI on PATH (the one you used for `codex login`).

[CmdletBinding()]
param(
  [string]$Service,                                          # empty => auto-detect
  [string]$Environment,
  [string]$AuthPath = (Join-Path $HOME ".codex\auth.json"),
  [switch]$SkipLogin,
  [switch]$DryRun
)

# NOTE: deliberately NOT setting $ErrorActionPreference='Stop'. `railway`/`codex`
# are npm .ps1 shims that spawn node; under 'Stop', any stderr they emit (e.g.
# "Unauthorized") is promoted to a TERMINATING error in PS 5.1 and aborts the
# script before our own $LASTEXITCODE checks run. We drive control flow off exit
# codes instead, and use try/catch (with -ErrorAction Stop) only on cmdlets.

# ASCII-only console output (a .ps1 without BOM is read as ANSI by PS 5.1, which
# would garble accented characters) -- kept accent-free on purpose.
function Fail($m) { Write-Host "[FAIL] $m" -ForegroundColor Red;    exit 1 }
function Ok($m)   { Write-Host "[ OK ] $m" -ForegroundColor Green }
function Info($m) { Write-Host "[ .. ] $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }

# Run an external CLI (or .ps1/.cmd shim) safely: force non-terminating behaviour,
# capture stdout, divert stderr to a temp file, and return the real exit code.
function Invoke-Cli {
  param([Parameter(Mandatory)][string]$Exe, [string[]]$CliArgs = @())
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $errFile = [System.IO.Path]::GetTempFileName()
  try {
    $stdout = & $Exe @CliArgs 2>$errFile
    $code = $LASTEXITCODE
    $stderr = if (Test-Path $errFile) { Get-Content $errFile -Raw } else { '' }
    [pscustomobject]@{ Code = $code; Out = ($stdout -join "`n"); Err = $stderr }
  } finally {
    $ErrorActionPreference = $prev
    Remove-Item $errFile -Force -ErrorAction SilentlyContinue
  }
}

# Auto-detect the codex service: the one whose Railway Root Directory is
# `codex-llm-server`. That is tied to the deployment config, not the random
# service name, so it keeps working if the service is renamed.
function Resolve-CodexService {
  $res = Invoke-Cli 'railway' @('status', '--json')
  if ($res.Code -ne 0 -or [string]::IsNullOrWhiteSpace($res.Out)) {
    Fail "Auto-detection impossible ('railway status --json' a echoue). Passe le service: -Service <nom>."
  }
  try { $data = $res.Out | ConvertFrom-Json -ErrorAction Stop }
  catch { Fail "Auto-detection impossible (JSON railway illisible). Passe -Service <nom>." }

  $names = @()
  foreach ($envEdge in @($data.environments.edges)) {
    foreach ($siEdge in @($envEdge.node.serviceInstances.edges)) {
      $node = $siEdge.node
      $dep = @($node.activeDeployments)[0]
      if (-not $dep) { $dep = $node.latestDeployment }
      $root = $dep.meta.rootDirectory
      if ($root -and $root.Trim('/').ToLower().EndsWith('codex-llm-server')) {
        $names += $node.serviceName
      }
    }
  }
  $unique = @($names | Sort-Object -Unique)
  if ($unique.Count -eq 1) { return [string]$unique[0] }
  if ($unique.Count -eq 0) {
    Fail "Aucun service avec Root Directory 'codex-llm-server' trouve dans le projet lie. Passe -Service <nom>."
  }
  Fail ("Plusieurs services candidats (" + ($unique -join ', ') + "). Precise avec -Service <nom>.")
}

# 1) Prerequisites -----------------------------------------------------------
if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
  Fail "Railway CLI introuvable. Installe-la (npm i -g @railway/cli), puis: railway login"
}
$who = Invoke-Cli 'railway' @('whoami')
if ($who.Code -ne 0) {
  Fail "Pas connecte a Railway. Lance d'abord: railway login"
}
Ok ("Railway CLI connecte (" + $who.Out.Trim() + ")")

# 1b) Resolve the target service (auto-detect unless -Service was given) -----
if ([string]::IsNullOrWhiteSpace($Service)) {
  $Service = Resolve-CodexService
  Ok "Service codex auto-detecte: $Service"
} else {
  Info "Service force (auto-detection ignoree): $Service"
}

# 2) Refresh the Codex login (interactive) ----------------------------------
$before = if (Test-Path $AuthPath) { (Get-Item $AuthPath).LastWriteTimeUtc } else { [datetime]::MinValue }

if (-not $SkipLogin) {
  if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    Fail "Codex CLI introuvable sur le PATH. Ouvre la meme CLI que celle utilisee pour 'codex login', ou relance avec -SkipLogin si auth.json est deja frais."
  }
  Info "Lancement de 'codex login' -- termine la connexion dans le navigateur..."
  & codex login
  if ($LASTEXITCODE -ne 0) { Fail "codex login a echoue (code $LASTEXITCODE)." }
}

# 3) Read + validate auth.json ----------------------------------------------
if (-not (Test-Path $AuthPath)) {
  Fail "Fichier auth introuvable: $AuthPath . Lance 'codex login' (sans -SkipLogin) pour le creer."
}
$after = (Get-Item $AuthPath).LastWriteTimeUtc
if (-not $SkipLogin -and $after -le $before) {
  Warn "auth.json n'a pas ete modifie par le login (annule ?). Je pousse le contenu actuel quand meme."
}

try {
  $raw = Get-Content $AuthPath -Raw -ErrorAction Stop
  $obj = $raw | ConvertFrom-Json -ErrorAction Stop
} catch {
  Fail "auth.json illisible ou JSON invalide: $($_.Exception.Message)"
}

$access = $null
if ($obj.tokens -and $obj.tokens.access_token) { $access = $obj.tokens.access_token }
elseif ($obj.access_token) { $access = $obj.access_token }
if ([string]::IsNullOrWhiteSpace($access)) {
  Fail "auth.json ne contient pas de token d'acces (structure inattendue)."
}
Ok "auth.json valide (token d'acces present)."

# 4) Compact + PowerShell-5.1-safe escaping ---------------------------------
# Compacting strips newlines/whitespace; escaping embedded quotes as \" is the
# only transform PS 5.1 native-arg passing needs for Codex tokens (JWT/UUID
# values contain no spaces, quotes or backslashes). Verified to round-trip.
$compact = $obj | ConvertTo-Json -Compress -Depth 30
$escaped = $compact.Replace('"', '\"')
$setArg  = "CODEX_AUTH_JSON=$escaped"

if ($DryRun) {
  Ok "DryRun: service cible = '$Service', auth.json valide et pret. Aucune modification poussee."
  exit 0
}

# 5) Push to Railway (setting a variable triggers a redeploy) ---------------
$railwayArgs = @('variables', '--set', $setArg, '--service', $Service)
if ($Environment) { $railwayArgs += @('--environment', $Environment) }

Info "Mise a jour de CODEX_AUTH_JSON sur le service '$Service'..."
$set = Invoke-Cli 'railway' $railwayArgs
if ($set.Code -ne 0) {
  if ($set.Err) { Write-Host $set.Err.Trim() -ForegroundColor DarkGray }
  Fail "Echec de 'railway variables --set'. Projet lie ? (railway link dans ce dossier) / service correct ? (-Service $Service)"
}
Ok "Variable mise a jour -- Railway redeploie le service '$Service'."

Info "Suis le demarrage:  railway logs --service $Service"
Write-Host "       Un boot sain affiche 'Codex auth preflight OK' puis 'Uvicorn running on http://[::]:18080'." -ForegroundColor DarkGray
Ok "Termine. Relance un upload DCE une fois le service redeploye."
