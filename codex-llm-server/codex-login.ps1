# codex-login.ps1 — log a SPECIFIC Codex account into its OWN isolated home.
#
#   .\codex-login.ps1 1     # compte 1 = PERSO (baptiste.faisy@gmail.com)     -> ~/.codex
#   .\codex-login.ps1 2     # compte 2 = DCE   (loofahs_...@icloud.com)       -> ~/.codex-dce
#
# WHY: plain `codex login` writes to whatever CODEX_HOME points at AND logs in
# whichever account is signed into your browser. This wrapper:
#   * pins CODEX_HOME to the right home for the chosen account (isolation),
#   * clears the old token in that home first (codex logout),
#   * tells you which account to pick in the browser,
#   * AFTER login, verifies the account that actually landed matches the expected
#     one (so a wrong browser session is caught immediately),
#   * restores your previous CODEX_HOME so your normal shell is left untouched.
#
# Options:
#   -DeviceAuth   use `codex login --device-auth` (URL + code). Best way to FORCE
#                 a specific account: open the URL in a PRIVATE browser window
#                 signed into that account.
#   -NoLogout     skip the `codex logout` that clears the old token first.
#   -Proxy <url>  route this login through an HTTP/HTTPS/SOCKS proxy AND remember
#                 it FOR THIS ACCOUNT (stored in <home>/proxy.txt). Examples:
#                   -Proxy http://127.0.0.1:8080
#                   -Proxy http://user:pass@proxy.example:3128
#                   -Proxy socks5://127.0.0.1:1080
#                 Once set, a bare `.\codex-login.ps1 <n>` reuses that account's
#                 proxy automatically. It sets HTTP_PROXY/HTTPS_PROXY/ALL_PROXY for
#                 the codex process ONLY (restored afterwards, like CODEX_HOME).
#   -RequireProxy mark THIS account "proxy mandatory" (stored in
#                 <home>/proxy.require). From then on, ANY login for this account
#                 with no active proxy is REFUSED (fail-closed, exit 3) instead of
#                 leaking your real IP. Set it once, together with -Proxy:
#                   .\codex-login.ps1 2 -Proxy http://127.0.0.1:8080 -RequireProxy
#   -ClearProxy   forget BOTH the remembered proxy and the mandatory-proxy flag
#                 for this account (delete proxy.txt + proxy.require), then log in
#                 without a proxy.
#
# ASCII-only output on purpose (a BOM-less .ps1 is read as ANSI by PS 5.1).

[CmdletBinding()]
param(
  [Parameter(Mandatory, Position = 0)]
  [ValidateSet('1', '2', '3')]
  [string]$Account,
  [switch]$DeviceAuth,
  [switch]$NoLogout,
  [string]$Proxy,
  [switch]$ClearProxy,
  [switch]$RequireProxy
)

# --- account map: edit emails here if your accounts change --------------------
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

# Decode the email claim from the id_token JWT in a home's auth.json (no node).
function Get-CodexEmail([string]$homePath) {
  $p = Join-Path $homePath 'auth.json'
  if (-not (Test-Path $p)) { return $null }
  try {
    $d = Get-Content $p -Raw | ConvertFrom-Json
    $seg = ($d.tokens.id_token -split '\.')[1]
    if (-not $seg) { return $null }
    $seg = $seg.Replace('-', '+').Replace('_', '/')
    switch ($seg.Length % 4) { 2 { $seg += '==' } 3 { $seg += '=' } 1 { return $null } }
    $json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($seg))
    return ($json | ConvertFrom-Json).email
  } catch { return $null }
}

# Resolve the REAL codex executable (not this script / not a function).
$codex = (Get-Command codex -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $codex) {
  Fail "codex CLI introuvable sur le PATH. Ouvre le terminal ou 'codex' fonctionne."
  exit 1
}

if (-not (Test-Path $sel.Home)) { New-Item -ItemType Directory -Path $sel.Home -Force | Out-Null }

Info ("Compte $Account = " + $sel.Label + "  ->  home: " + $sel.Home)
Warn ("Dans le navigateur, connecte-toi bien avec:  " + $sel.Email)

# --- per-account proxy: remembered in the account's own Codex home -------------
# Two small files live INSIDE $sel.Home so they stay tied to THIS account:
#   proxy.txt      the proxy URL to use
#   proxy.require  presence => this account MUST be logged in through a proxy
# Priority:
#   -ClearProxy    -> forget both files (no proxy, no requirement, this run)
#   -Proxy <url>   -> use it AND persist it (proxy.txt) for next time
#   (neither)      -> reuse the account's remembered proxy if proxy.txt exists
# Then, if the account is flagged 'proxy required' and no proxy is active, the
# login is REFUSED (fail-closed) so the real IP is never leaked.
$proxyFile   = Join-Path $sel.Home 'proxy.txt'
$requireFile = Join-Path $sel.Home 'proxy.require'
$effProxy    = $null

if ($ClearProxy) {
  $removed = $false
  if (Test-Path $proxyFile)   { Remove-Item $proxyFile   -Force -ErrorAction SilentlyContinue; $removed = $true }
  if (Test-Path $requireFile) { Remove-Item $requireFile -Force -ErrorAction SilentlyContinue; $removed = $true }
  if ($removed) { Ok ("Proxy et exigence 'proxy obligatoire' oublies pour le compte " + $Account + ".") }
  else { Info ("Aucun proxy memorise pour le compte " + $Account + " (rien a supprimer).") }
}
else {
  if ($Proxy) {
    $effProxy = $Proxy.Trim()
    # On ecrit un bloc explicatif (#) + l'URL. Les lecteurs ignorent les lignes #.
    $lines = @(
      '# --- codex-proxy : proxy de CE compte ---',
      '# La 1re ligne NON-commentaire (#) est l''URL du proxy utilisee.',
      '# Syntaxe : <scheme>://[user:pass@]host:port   (scheme = http | https | socks5)',
      '# Exemples : http://user:pass@1.2.3.4:8080  |  socks5://user:pass@host:1080',
      "# Voisin 'proxy.require' present = proxy OBLIGATOIRE (fail-closed, pas de fuite).",
      '# ---',
      $effProxy
    )
    Set-Content -Path $proxyFile -Value $lines -Encoding ascii
    Ok ("Proxy memorise pour le compte " + $Account + ": " + $effProxy)
  }
  elseif (Test-Path $proxyFile) {
    # 1re ligne non-commentaire (#) = l'URL.
    $saved = Get-Content $proxyFile | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') } | Select-Object -First 1
    if ($saved) {
      $effProxy = $saved.Trim()
      Info ("Proxy memorise du compte " + $Account + " repris: " + $effProxy)
    }
  }

  # Persist the 'proxy required' lock the first time -RequireProxy is passed.
  if ($RequireProxy -and -not (Test-Path $requireFile)) {
    Set-Content -Path $requireFile -Value 'proxy required for this account' -Encoding ascii -NoNewline
    Ok ("Compte " + $Account + " marque: proxy OBLIGATOIRE (tout login direct sera refuse).")
  }
  $proxyRequired = (Test-Path $requireFile)

  # Fail-closed: refuse a proxy-less login for an account that requires one.
  if ($proxyRequired -and -not $effProxy) {
    Fail ("Compte " + $Account + " marque 'proxy obligatoire' mais AUCUN proxy actif -> login refuse (pas de fuite d'IP).")
    Warn "=> Relance avec:  -Proxy <url>   (memorise le proxy), ou   -ClearProxy   (leve l'exigence)."
    exit 3
  }
}

$exitCode = 0
$prevHome = $env:CODEX_HOME
# Snapshot proxy env so we can restore it exactly (including "was unset").
$prevProxy = @{
  HTTP_PROXY  = $env:HTTP_PROXY
  HTTPS_PROXY = $env:HTTPS_PROXY
  ALL_PROXY   = $env:ALL_PROXY
}
try {
  $env:CODEX_HOME = $sel.Home

  if ($effProxy) {
    Info ("Proxy actif pour cette connexion (codex uniquement): " + $effProxy)
    $env:HTTP_PROXY  = $effProxy
    $env:HTTPS_PROXY = $effProxy
    $env:ALL_PROXY   = $effProxy
  }

  if (-not $NoLogout) {
    Info "Nettoyage de l'ancien token de ce home (codex logout)..."
    & $codex logout 2>$null | Out-Null
  }

  $loginArgs = @('login')
  if ($DeviceAuth) { $loginArgs += '--device-auth' }
  Info ("Lancement de:  codex " + ($loginArgs -join ' ') + "   (termine la connexion dans le navigateur)")
  & $codex @loginArgs
  $code = $LASTEXITCODE

  if ($code -ne 0) {
    Fail "codex login a echoue (code $code)."
    $exitCode = $code
  }
  else {
    $got = Get-CodexEmail $sel.Home
    if (-not $got) {
      Warn "Login termine, mais impossible de relire le compte dans $($sel.Home)\auth.json."
    }
    elseif (-not $sel.Email) {
      Ok ("home " + $sel.Home + "  =  " + $got + "   (compte " + $Account + " OK, isole - email non verrouille)")
    }
    elseif ($got -ieq $sel.Email) {
      Ok ("home " + $sel.Home + "  =  " + $got + "   (compte " + $Account + " OK, isole)")
    }
    else {
      Warn ("ATTENTION: ce home contient maintenant '" + $got + "' au lieu de '" + $sel.Email + "'.")
      Warn "=> Mauvais compte choisi dans le navigateur. Relance avec -DeviceAuth et une fenetre privee connectee au bon compte."
      $exitCode = 2
    }
  }
}
finally {
  if ($null -eq $prevHome) { Remove-Item Env:\CODEX_HOME -ErrorAction SilentlyContinue }
  else { $env:CODEX_HOME = $prevHome }

  if ($effProxy) {
    foreach ($k in @('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY')) {
      if ($null -eq $prevProxy[$k]) { Remove-Item ("Env:\" + $k) -ErrorAction SilentlyContinue }
      else { Set-Item ("Env:\" + $k) $prevProxy[$k] }
    }
  }
}

if ($Account -eq '2' -and $exitCode -eq 0) {
  Write-Host ""
  Info "Compte DCE reconnecte. Pour le propager sur Railway, enchaine avec:"
  Write-Host "        .\refresh-dce.ps1 -SkipLogin" -ForegroundColor DarkGray
}

exit $exitCode
