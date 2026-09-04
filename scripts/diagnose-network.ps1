<#
.SYNOPSIS
  Prueft, ob die externen Abhaengigkeiten dieser App vom aktuellen Rechner
  erreichbar sind - und unterscheidet dabei TLS-Interception von echtem Block.

.DESCRIPTION
  Fuer jeden Host werden drei Ebenen getestet:

    1. TLS-Handshake  -> welcher Aussteller signiert das Zertifikat?
                         Ein Proxy-Aussteller belegt aktive TLS-Interception.
    2. curl.exe       -> nutzt den Windows-Zertifikatsspeicher (wie der Browser).
    3. node           -> nutzt den mitgelieferten CA-Store von Node.js.

  Aus der Kombination ergibt sich die Ursache:

    curl ok  + node Zertifikatsfehler  -> Fall A: TLS-Interception, lokal fixbar
                                          (scripts/setup-corporate-ca.ps1)
    curl blockiert / Timeout           -> Fall B: URL-Filter, braucht Whitelist
                                          oder lokalen Ersatz
    curl ok  + node ok                 -> Host in Ordnung

.PARAMETER SupabaseHost
  Ueberschreibt den aus .env.local gelesenen Supabase-Host. Nuetzlich, wenn das
  Skript ohne Repo-Umgebung laeuft.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\diagnose-network.ps1

.EXAMPLE
  # Wenn die Ausfuehrung von Skriptdateien per Gruppenrichtlinie gesperrt ist:
  Get-Content .\diagnose-network.ps1 -Raw | Invoke-Expression
#>

[CmdletBinding()]
param(
  # Zusaetzliche Hosts, die mitgetestet werden sollen.
  [string[]] $ExtraHosts = @(),

  [string] $SupabaseHost
)

$ErrorActionPreference = 'Continue'

# Bekannte Aussteller-Kennungen von Inspektions-Proxys.
$ProxyIssuerPattern = 'Zscaler|Netskope|Blue ?Coat|Forcepoint|Palo Alto|McAfee Web|Umbrella|Fortinet|Sophos|Symantec Web'

# Fallback, falls das Skript ohne .env.local laeuft - etwa als einzelne Datei auf
# dem Desktop kopiert. Bei einem Projektwechsel wird der Wert aus .env.local
# bevorzugt, dieser Eintrag greift nur als letzte Instanz.
$DefaultSupabaseHost = 'epdtzrsgukrxecaitlzy.supabase.co'

# Supabase-Host ermitteln. Reihenfolge: Parameter, .env.local neben oder ueber
# dem Skript, aktuelles Arbeitsverzeichnis, Fallback-Konstante.
function Get-SupabaseHost {
  if (-not [string]::IsNullOrWhiteSpace($SupabaseHost)) {
    return [pscustomobject] @{ Host = $SupabaseHost; Source = 'Parameter' }
  }

  $roots = @()
  # $PSScriptRoot ist leer, wenn das Skript ueber Invoke-Expression laeuft.
  if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
    $roots += (Split-Path -Parent $PSScriptRoot)
    $roots += $PSScriptRoot
  }
  $roots += (Get-Location).Path

  foreach ($root in ($roots | Where-Object { $_ } | Select-Object -Unique)) {
    foreach ($name in @('.env.local', '.env.local.example')) {
      $path = Join-Path $root $name
      if (-not (Test-Path $path)) { continue }
      $line = Select-String -Path $path -Pattern '^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(\S+)' |
              Select-Object -First 1
      if ($null -eq $line) { continue }
      $value = $line.Matches[0].Groups[1].Value.Trim('"').Trim("'")
      if ($value -match 'your-project') { continue }
      try {
        return [pscustomobject] @{ Host = ([Uri] $value).Host; Source = $path }
      } catch { continue }
    }
  }

  return [pscustomobject] @{ Host = $DefaultSupabaseHost; Source = 'Fallback im Skript' }
}

$supabaseInfo = Get-SupabaseHost
$supabaseHostName = $supabaseInfo.Host

# Was die App tatsaechlich braucht. "Runtime" = fuer die Suche zwingend,
# "Ingestion" = nur beim Befuellen des Korpus, "Browser" = nur im Frontend.
$Targets = @(
  @{ Host = 'api.openai.com';                       Url = 'https://api.openai.com/v1/models';                   Scope = 'Runtime';   Note = 'Embeddings, LLM-Judge' }
)

if ($supabaseHostName) {
  $Targets += @{ Host = $supabaseHostName; Url = ('https://{0}/rest/v1/' -f $supabaseHostName); Scope = 'Runtime'; Note = 'Hybrid-Search-RPC, alle Daten' }
}

$Targets += @(
  @{ Host = 'www.googleapis.com';                   Url = 'https://www.googleapis.com/discovery/v1/apis';        Scope = 'Ingestion'; Note = 'YouTube Data API' }
  @{ Host = 'registry.npmjs.org';                   Url = 'https://registry.npmjs.org/next';                     Scope = 'Setup';     Note = 'npm install' }
  @{ Host = 'www.youtube.com';                      Url = 'https://www.youtube.com/robots.txt';                  Scope = 'Browser';   Note = 'Player-iframe' }
  @{ Host = 'i.ytimg.com';                          Url = 'https://i.ytimg.com/generate_204';                    Scope = 'Browser';   Note = 'Thumbnails' }
)

foreach ($h in $ExtraHosts) {
  $Targets += @{ Host = $h; Url = "https://$h/"; Scope = 'Extra'; Note = 'manuell ergaenzt' }
}

function Write-Head {
  param([string] $Text)
  Write-Host ''
  Write-Host $Text -ForegroundColor Cyan
  Write-Host ('-' * $Text.Length) -ForegroundColor DarkGray
}

# Loest den Namen auf. Schlaegt das fehl, ist die Ursache entweder ein
# NXDOMAIN-Sinkhole des Gateways oder der Host existiert wirklich nicht - etwa
# weil ein pausiertes Supabase-Projekt seine Subdomain nicht mehr veroeffentlicht.
function Resolve-HostDns {
  param([string] $HostName)

  try {
    $entries = [System.Net.Dns]::GetHostAddresses($HostName)
    $addresses = $entries | ForEach-Object { $_.IPAddressToString }
    return [pscustomobject] @{ Resolved = $true; Addresses = $addresses; Error = $null }
  }
  catch {
    return [pscustomobject] @{ Resolved = $false; Addresses = @(); Error = $_.Exception.InnerException.Message }
  }
}

# Baut eine TLS-Verbindung auf und liefert Aussteller + Subject des Leaf-Zertifikats.
# Die Validierung wird bewusst uebergangen, weil wir genau die Kette sehen wollen,
# die der Proxy praesentiert.
function Get-TlsCertificateInfo {
  param(
    [string] $HostName,
    [int]    $Port = 443,
    [int]    $TimeoutMs = 8000
  )

  $result = [ordered]@{ Reachable = $false; Issuer = $null; Subject = $null; Error = $null }
  $client = New-Object System.Net.Sockets.TcpClient

  try {
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs)) {
      $result.Error = "TCP-Timeout nach $TimeoutMs ms"
      return [pscustomobject] $result
    }
    $client.EndConnect($async)

    $acceptAll = [System.Net.Security.RemoteCertificateValidationCallback] {
      param($senderObj, $certificate, $chainObj, $sslErrors)
      return $true
    }

    $ssl = New-Object System.Net.Security.SslStream($client.GetStream(), $false, $acceptAll)
    try {
      $ssl.AuthenticateAsClient($HostName)
      $leaf = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
      $result.Reachable = $true
      $result.Issuer = $leaf.Issuer
      $result.Subject = $leaf.Subject
    }
    finally {
      $ssl.Dispose()
    }
  }
  catch {
    $result.Error = $_.Exception.Message
  }
  finally {
    $client.Close()
  }

  return [pscustomobject] $result
}

# curl.exe nutzt Schannel und damit denselben Zertifikatsspeicher wie der Browser.
# Der Body-Anfang verraet eine Block-Seite des Proxys.
function Invoke-CurlProbe {
  param([string] $Url)

  $curl = Join-Path $env:SystemRoot 'System32\curl.exe'
  if (-not (Test-Path $curl)) {
    return [pscustomobject] @{ Status = $null; Body = ''; Error = 'curl.exe nicht gefunden' }
  }

  # Kein 2>&1: in PS 5.1 verpackt das stderr einer native Exe in ErrorRecords.
  # Bei einem Fehlschlag liefert --write-out ohnehin HTTPSTATUS:000.
  $body = & $curl --silent --max-time 15 --location `
                  --write-out "`nHTTPSTATUS:%{http_code}" $Url | Out-String

  $status = $null
  $match = [regex]::Match($body, 'HTTPSTATUS:(\d{3})')
  if ($match.Success) { $status = [int] $match.Groups[1].Value }

  $snippet = ($body -replace 'HTTPSTATUS:\d{3}', '').Trim()
  if ($snippet.Length -gt 400) { $snippet = $snippet.Substring(0, 400) }

  return [pscustomobject] @{ Status = $status; Body = $snippet; Error = $null }
}

# Fuehrt alle URLs in einem Node-Prozess aus, damit der CA-Store von Node greift.
function Invoke-NodeProbe {
  param([string[]] $Urls)

  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($null -eq $node) { return $null }

  $js = @'
const targets = process.argv.slice(2);
(async () => {
  for (const url of targets) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      console.log(['OK', url, res.status].join('\t'));
    } catch (err) {
      const code = (err.cause && (err.cause.code || err.cause.message)) || err.code || err.message;
      console.log(['ERR', url, code].join('\t'));
    }
  }
})();
'@

  $file = Join-Path $env:TEMP ('probe-' + $PID + '.js')
  Set-Content -Path $file -Value $js -Encoding ascii

  try {
    # Kein 2>&1 - siehe Kommentar in Invoke-CurlProbe.
    $raw = & $node.Source $file @Urls | Out-String
  }
  finally {
    Remove-Item $file -ErrorAction SilentlyContinue
  }

  $map = @{}
  foreach ($line in ($raw -split "`r?`n")) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split "`t"
    if ($parts.Count -ge 3) {
      $map[$parts[1]] = [pscustomobject] @{ Kind = $parts[0]; Detail = $parts[2] }
    }
  }
  return $map
}

# ---------------------------------------------------------------- Umgebung ----

Write-Head 'Umgebung'

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCmd) {
  Write-Host '  node          : NICHT GEFUNDEN - Node.js installieren, sonst laeuft die App gar nicht.' -ForegroundColor Red
} else {
  $nodeVersion = (& $nodeCmd.Source --version) -replace '\s', ''
  Write-Host ('  node          : {0} ({1})' -f $nodeVersion, $nodeCmd.Source)
  $major = 0
  $vm = [regex]::Match($nodeVersion, 'v(\d+)')
  if ($vm.Success) { $major = [int] $vm.Groups[1].Value }
  if ($major -lt 20) {
    Write-Host '                  Achtung: Next 16 erwartet Node 20+.' -ForegroundColor Yellow
  }
}

$caVar = [Environment]::GetEnvironmentVariable('NODE_EXTRA_CA_CERTS', 'Process')
if ([string]::IsNullOrWhiteSpace($caVar)) {
  Write-Host '  NODE_EXTRA_CA_CERTS : nicht gesetzt'
} else {
  $exists = Test-Path $caVar
  Write-Host ('  NODE_EXTRA_CA_CERTS : {0} (Datei vorhanden: {1})' -f $caVar, $exists)
}

$npmCaFile = & npm config get cafile 2>$null
if ($null -ne $npmCaFile) {
  Write-Host ('  npm cafile    : {0}' -f ($npmCaFile -replace '\s', ''))
}

Write-Host ('  Supabase-Host  : {0}' -f $supabaseHostName)
Write-Host ('                   Quelle: {0}' -f $supabaseInfo.Source)

$proxyProcesses = Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName -match 'zsa|zscaler|nsdiag|stAgent|WSAgent' } |
  Select-Object -ExpandProperty ProcessName -Unique
if ($proxyProcesses) {
  Write-Host ('  Proxy-Agent    : {0}' -f ($proxyProcesses -join ', ')) -ForegroundColor Yellow
} else {
  Write-Host '  Proxy-Agent    : kein bekannter Agent im Prozesslisting'
}

# ------------------------------------------------------------------ Tests ----

Write-Head 'Hosts'

$nodeResults = Invoke-NodeProbe -Urls ($Targets | ForEach-Object { $_.Url })
if ($null -eq $nodeResults) {
  Write-Host '  (Node-Ebene uebersprungen: node nicht verfuegbar)' -ForegroundColor Yellow
  $nodeResults = @{}
}

$report = @()

foreach ($t in $Targets) {
  Write-Host ''
  Write-Host ('  {0}  [{1}] {2}' -f $t.Host, $t.Scope, $t.Note) -ForegroundColor White

  $dns = Resolve-HostDns -HostName $t.Host
  if ($dns.Resolved) {
    Write-Host ('    DNS            : {0}' -f ($dns.Addresses -join ', ')) -ForegroundColor Gray
  } else {
    Write-Host ('    DNS            : keine Aufloesung - {0}' -f $dns.Error) -ForegroundColor Red
  }

  $tls = Get-TlsCertificateInfo -HostName $t.Host
  $intercepted = $false

  if ($tls.Reachable) {
    $intercepted = ($tls.Issuer -match $ProxyIssuerPattern)
    $issuerColor = 'Gray'
    if ($intercepted) { $issuerColor = 'Yellow' }
    Write-Host ('    TLS-Aussteller : {0}' -f $tls.Issuer) -ForegroundColor $issuerColor
  } else {
    Write-Host ('    TLS            : nicht erreichbar - {0}' -f $tls.Error) -ForegroundColor Red
  }

  $curl = Invoke-CurlProbe -Url $t.Url
  $curlOk = $false
  $blockPage = $false

  if ($null -ne $curl.Status) {
    # 2xx/401/403-mit-JSON sind gueltige API-Antworten ohne Key; eine HTML-Seite
    # mit Proxy-Signatur ist dagegen die Block-Seite.
    $blockPage = ($curl.Body -match 'zscaler|access denied|blocked by|policy violation|url filtering')
    $curlOk = (-not $blockPage) -and ($curl.Status -ge 200) -and ($curl.Status -lt 500)
    $statusColor = 'Green'
    if (-not $curlOk) { $statusColor = 'Red' }
    Write-Host ('    curl (Windows) : HTTP {0}' -f $curl.Status) -ForegroundColor $statusColor
    if ($blockPage) {
      Write-Host ('                     Block-Seite erkannt: {0}' -f ($curl.Body -replace '\s+', ' ')) -ForegroundColor Red
    }
  } else {
    Write-Host ('    curl (Windows) : kein Status - {0}' -f ($curl.Body -replace '\s+', ' ')) -ForegroundColor Red
  }

  $nodeInfo = $nodeResults[$t.Url]
  $nodeOk = $false
  $nodeCertError = $false

  if ($null -ne $nodeInfo) {
    if ($nodeInfo.Kind -eq 'OK') {
      $nodeOk = $true
      Write-Host ('    node           : HTTP {0}' -f $nodeInfo.Detail) -ForegroundColor Green
    } else {
      $nodeCertError = ($nodeInfo.Detail -match 'CERT|SELF_SIGNED|UNABLE_TO_(VERIFY|GET)')
      Write-Host ('    node           : FEHLER {0}' -f $nodeInfo.Detail) -ForegroundColor Red
    }
  } else {
    Write-Host '    node           : (kein Ergebnis)' -ForegroundColor DarkGray
  }

  # Verdikt
  $verdict = 'UNKLAR'
  $hint = 'Ausgabe oben manuell bewerten.'

  if ($nodeOk -and $curlOk) {
    $verdict = 'OK'
    $hint = 'Host funktioniert auf beiden Ebenen.'
  }
  elseif ($curlOk -and $nodeCertError) {
    $verdict = 'FALL A'
    $hint = 'TLS-Interception. Fix: scripts\setup-corporate-ca.ps1 ausfuehren.'
  }
  elseif (-not $dns.Resolved) {
    $verdict = 'DNS'
    if ($t.Host -match 'supabase\.co$') {
      $hint = 'Name loest nicht auf. Bei Supabase meist ein pausiertes Projekt - im Dashboard "Resume" druecken. Sonst NXDOMAIN-Sinkhole des Gateways.'
    } else {
      $hint = 'Name loest nicht auf: NXDOMAIN-Sinkhole des Gateways oder Host existiert nicht. Auf einem Rechner ohne Proxy gegentesten.'
    }
  }
  elseif ($blockPage -or (-not $tls.Reachable)) {
    $verdict = 'FALL B'
    $hint = 'URL-Filter oder DNS-Sinkhole. Whitelist beantragen oder lokal ersetzen.'
  }
  elseif ($curlOk -and (-not $nodeOk) -and ($null -ne $nodeInfo)) {
    $verdict = 'FALL A?'
    $hint = 'Browser-Ebene ok, Node nicht - Fehlercode oben pruefen.'
  }

  $verdictColor = 'Yellow'
  if ($verdict -eq 'OK')      { $verdictColor = 'Green' }
  if ($verdict -like 'FALL*') { $verdictColor = 'Red' }
  if ($verdict -eq 'DNS')     { $verdictColor = 'Red' }
  Write-Host ('    -> {0}: {1}' -f $verdict, $hint) -ForegroundColor $verdictColor

  $report += [pscustomobject] @{
    Host        = $t.Host
    Scope       = $t.Scope
    Intercepted = $intercepted
    Verdict     = $verdict
  }
}

# ------------------------------------------------------------ Zusammenfassung -

Write-Head 'Zusammenfassung'

$report | Format-Table -AutoSize | Out-String | Write-Host

$runtime = $report | Where-Object { $_.Scope -eq 'Runtime' }
$runtimeBad = $runtime | Where-Object { $_.Verdict -ne 'OK' }

if (-not $runtimeBad) {
  Write-Host '  Die laufzeitkritischen Hosts sind erreichbar - npm run dev sollte funktionieren.' -ForegroundColor Green
}
elseif ($runtimeBad | Where-Object { $_.Verdict -eq 'DNS' }) {
  Write-Host '  Mindestens ein Host loest nicht auf. Das ist kein Proxy-Problem im engeren Sinn:' -ForegroundColor Red
  Write-Host '  zuerst pruefen, ob das Supabase-Projekt laeuft (Dashboard -> Resume). Ein pausiertes' -ForegroundColor Red
  Write-Host '  Projekt veroeffentlicht seine Subdomain nicht mehr, dann scheitert jeder Rechner.' -ForegroundColor Red
}
elseif ($runtimeBad | Where-Object { $_.Verdict -like 'FALL A*' }) {
  Write-Host '  Naechster Schritt: scripts\setup-corporate-ca.ps1 ausfuehren, Terminal neu starten,' -ForegroundColor Yellow
  Write-Host '  danach dieses Skript erneut laufen lassen.' -ForegroundColor Yellow
}
else {
  Write-Host '  Mindestens ein laufzeitkritischer Host ist gefiltert (Fall B).' -ForegroundColor Red
  Write-Host '  Siehe docs/corporate-network.md, Abschnitt "Fall B".' -ForegroundColor Red
}

Write-Host ''
Write-Host '  Manuell noch pruefen: laesst sich https://www.youtube.com im Browser oeffnen?'
Write-Host '  Ohne YouTube-Zugriff findet die Suche Treffer, aber kein Video spielt.'
Write-Host ''
