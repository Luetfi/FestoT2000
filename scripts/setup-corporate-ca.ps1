<#
.SYNOPSIS
  Exportiert die Root-Zertifikate des Firmen-Proxys als PEM-Bundle und macht sie
  fuer Node.js nutzbar (NODE_EXTRA_CA_CERTS).

.DESCRIPTION
  Node.js bringt seinen eigenen CA-Store mit und ignoriert den Windows-
  Zertifikatsspeicher. Bei aktiver TLS-Interception vertraut der Browser dem
  Proxy-Zertifikat also, Node aber nicht - daher Fehler wie
  SELF_SIGNED_CERT_IN_CHAIN oder UNABLE_TO_VERIFY_LEAF_SIGNATURE.

  Ablauf:

    0. Vorpruefung: Vertraut Node der Kette des Referenz-Hosts schon? Dann ist
       nichts zu tun und das Skript bricht ab, statt sinnlos oeffentliche
       Zwischenzertifikate zu exportieren.
    1. Suche im Windows-Zertifikatsspeicher nach CAs bekannter Inspektions-Proxys.
    2. Export der im TLS-Handshake tatsaechlich praesentierten Kette - erfasst
       auch Gateways, deren Name nicht im Suchmuster steht.
    3. Deduplizieren, als PEM schreiben, NODE_EXTRA_CA_CERTS setzen, gegentesten.

  NODE_EXTRA_CA_CERTS *ergaenzt* den Node-Store, ersetzt ihn nicht. Oeffentliche
  Zertifikate bleiben also gueltig. npm, next und alle tsx-Skripte laufen auf
  Node und uebernehmen die Variable automatisch - ein separates
  "npm config set cafile" ist unnoetig und waere restriktiver, weil es den
  CA-Satz ersetzt.

.PARAMETER OutFile
  Zielpfad des PEM-Bundles. Standard liegt bewusst ausserhalb des Repos, damit
  Firmen-Zertifikate nicht versehentlich committed werden.

.PARAMETER Scope
  Geltungsbereich der Umgebungsvariable: User (Standard) oder Machine
  (erfordert administrative Rechte).

.PARAMETER ReferenceHost
  Host, gegen den Vertrauen geprueft und die Kette abgeholt wird.

.PARAMETER Force
  Auch dann exportieren, wenn Node der Kette bereits vertraut.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\setup-corporate-ca.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\setup-corporate-ca.ps1 -WhatIf
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string] $OutFile = (Join-Path $env:USERPROFILE '.certs\corporate-ca.pem'),

  [ValidateSet('User', 'Machine')]
  [string] $Scope = 'User',

  [string] $ReferenceHost = 'api.openai.com',

  [switch] $Force
)

$ErrorActionPreference = 'Stop'

$ProxyIssuerPattern = 'Zscaler|Netskope|Blue ?Coat|Forcepoint|Palo Alto|McAfee Web|Umbrella|Fortinet|Sophos|Symantec Web'

function Write-Head {
  param([string] $Text)
  Write-Host ''
  Write-Host $Text -ForegroundColor Cyan
  Write-Host ('-' * $Text.Length) -ForegroundColor DarkGray
}

function Invoke-NodeScript {
  param([string] $Body, [string[]] $Arguments = @())

  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($null -eq $node) { return $null }

  # -WhatIf:$false, weil das Anlegen der Hilfsdatei nicht die Operation ist, die
  # der Nutzer bestaetigt - ohne das laeuft der Trockenlauf gegen eine fehlende Datei.
  $file = Join-Path $env:TEMP ('ca-tool-' + $PID + '.js')
  Set-Content -Path $file -Value $Body -Encoding ascii -WhatIf:$false
  try {
    # Kein 2>&1: in PS 5.1 verpackt das stderr einer native Exe in ErrorRecords
    # und setzt $? auf false, selbst bei Exit-Code 0. Das JS faengt Fehler
    # ohnehin selbst ab und schreibt sie nach stdout.
    return (& $node.Source $file @Arguments | Out-String)
  }
  finally {
    Remove-Item $file -ErrorAction SilentlyContinue -WhatIf:$false
  }
}

# Klassifiziert, warum Node einen Host nicht erreicht. Nur bei einem
# Zertifikatsfehler ist dieses Skript das richtige Werkzeug.
function Test-NodeTrust {
  param([string] $Url)

  $js = @'
(async () => {
  try {
    const res = await fetch(process.argv[2]);
    console.log('OK\t' + res.status);
  } catch (err) {
    const code = (err.cause && (err.cause.code || err.cause.message)) || err.code || err.message;
    console.log('ERR\t' + code);
  }
})();
'@

  $raw = Invoke-NodeScript -Body $js -Arguments @($Url)
  if ($null -eq $raw) {
    return [pscustomobject] @{ Kind = 'NONODE'; Detail = 'node nicht gefunden' }
  }

  $line = ($raw -split "`r?`n" | Where-Object { $_ -match "`t" } | Select-Object -First 1)
  if ([string]::IsNullOrWhiteSpace($line)) {
    return [pscustomobject] @{ Kind = 'OTHER'; Detail = ($raw -replace '\s+', ' ').Trim() }
  }

  $parts = $line -split "`t"
  if ($parts[0] -eq 'OK') {
    return [pscustomobject] @{ Kind = 'OK'; Detail = $parts[1] }
  }

  $detail = $parts[1]
  $kind = 'OTHER'
  if ($detail -match 'CERT|SELF_SIGNED|UNABLE_TO_(VERIFY|GET)')      { $kind = 'CERT' }
  elseif ($detail -match 'ENOTFOUND|EAI_AGAIN')                       { $kind = 'DNS' }
  elseif ($detail -match 'ECONNREFUSED|ECONNRESET|ETIMEDOUT|TIMEOUT') { $kind = 'BLOCK' }

  return [pscustomobject] @{ Kind = $kind; Detail = $detail }
}

function ConvertTo-Pem {
  param([System.Security.Cryptography.X509Certificates.X509Certificate2] $Certificate)

  $b64 = [Convert]::ToBase64String($Certificate.RawData, 'InsertLineBreaks')
  $lines = @()
  $lines += ('# Subject: ' + $Certificate.Subject)
  $lines += ('# Issuer : ' + $Certificate.Issuer)
  $lines += ('# Gueltig bis: ' + $Certificate.NotAfter.ToString('yyyy-MM-dd'))
  $lines += '-----BEGIN CERTIFICATE-----'
  $lines += ($b64 -split "`r?`n")
  $lines += '-----END CERTIFICATE-----'
  $lines += ''
  return ($lines -join "`n")
}

# Holt die vom Gegenueber praesentierte Kette. Bei aktivem Proxy sind das dessen
# Zertifikate, nicht die des echten Ziels - genau die brauchen wir.
function Get-PresentedChain {
  param([string] $HostName, [int] $Port = 443)

  $client = New-Object System.Net.Sockets.TcpClient
  $collected = @()

  try {
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(8000)) {
      Write-Host ('  TCP-Timeout gegen {0} - Handshake-Stufe uebersprungen.' -f $HostName) -ForegroundColor Yellow
      return @()
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
      Write-Host ('  Leaf-Aussteller: {0}' -f $leaf.Issuer) -ForegroundColor Gray

      $chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
      $chain.ChainPolicy.RevocationMode = 'NoCheck'
      $chain.ChainPolicy.VerificationFlags = 'AllowUnknownCertificateAuthority'
      [void] $chain.Build($leaf)

      # Element 0 ist das Leaf-Zertifikat des Hosts - das gehoert nicht ins
      # CA-Bundle. Alles darueber sind Intermediates und die Root.
      for ($i = 1; $i -lt $chain.ChainElements.Count; $i++) {
        $collected += $chain.ChainElements[$i].Certificate
      }
    }
    finally {
      $ssl.Dispose()
    }
  }
  catch {
    Write-Host ('  Handshake gegen {0} fehlgeschlagen: {1}' -f $HostName, $_.Exception.Message) -ForegroundColor Yellow
  }
  finally {
    $client.Close()
  }

  return $collected
}

# ------------------------------------------------------------ 0. Vorpruefung ---

Write-Head ('0. Vorpruefung: vertraut Node der Kette von {0}?' -f $ReferenceHost)

$trust = Test-NodeTrust -Url ('https://{0}/' -f $ReferenceHost)
Write-Host ('  Ergebnis: {0} ({1})' -f $trust.Kind, $trust.Detail)

switch ($trust.Kind) {
  'OK' {
    if (-not $Force) {
      Write-Host ''
      Write-Host '  Node vertraut der Zertifikatskette bereits - es findet keine TLS-Interception' -ForegroundColor Green
      Write-Host '  statt, die Node blockiert. Dieses Skript ist hier nicht das richtige Werkzeug.' -ForegroundColor Green
      Write-Host ''
      Write-Host '  Laeuft die App trotzdem nicht, liegt es an einem URL-Filter oder an einem'
      Write-Host '  anderen Host. Erst scripts\diagnose-network.ps1 ausfuehren.'
      Write-Host '  Export dennoch erzwingen: -Force'
      exit 0
    }
    Write-Host '  -Force gesetzt: Export wird trotzdem versucht.' -ForegroundColor Yellow
  }
  'DNS' {
    Write-Host ''
    Write-Host ('  {0} loest nicht auf. Das ist kein Zertifikatsproblem.' -f $ReferenceHost) -ForegroundColor Red
    Write-Host '  Mit einem erreichbaren Host erneut versuchen: -ReferenceHost <host>' -ForegroundColor Red
    exit 1
  }
  'BLOCK' {
    Write-Host ''
    Write-Host ('  Verbindung zu {0} wird abgewiesen - Fall B (URL-Filter).' -f $ReferenceHost) -ForegroundColor Red
    Write-Host '  Siehe docs/corporate-network.md, Abschnitt "Fall B".' -ForegroundColor Red
    exit 1
  }
  'NONODE' {
    Write-Host '  node nicht gefunden - Vorpruefung uebersprungen, es wird nur der' -ForegroundColor Yellow
    Write-Host '  Zertifikatsspeicher nach bekannten Proxy-CAs durchsucht.' -ForegroundColor Yellow
  }
  'CERT' {
    Write-Host '  Zertifikatsfehler bestaetigt - Fall A. Export ist der richtige Weg.' -ForegroundColor Yellow
  }
  default {
    Write-Host '  Unklares Ergebnis, es wird trotzdem versucht.' -ForegroundColor Yellow
  }
}

# Die Handshake-Stufe nur nutzen, wenn ein Zertifikatsfehler vorliegt oder der
# Export erzwungen wurde. Sonst wuerden legitime oeffentliche Zwischenzertifikate
# im Bundle landen - harmlos, aber irrefuehrend.
$useHandshake = ($trust.Kind -eq 'CERT') -or $Force.IsPresent

# ------------------------------------------------------- 1. Store durchsuchen -

Write-Head '1. Windows-Zertifikatsspeicher durchsuchen'

$stores = @(
  'Cert:\LocalMachine\Root'
  'Cert:\LocalMachine\CA'
  'Cert:\CurrentUser\Root'
  'Cert:\CurrentUser\CA'
)

$fromStore = @()
foreach ($store in $stores) {
  if (-not (Test-Path $store)) { continue }
  $hits = Get-ChildItem $store -ErrorAction SilentlyContinue |
          Where-Object { ($_.Subject -match $ProxyIssuerPattern) -or ($_.Issuer -match $ProxyIssuerPattern) }
  foreach ($hit in $hits) {
    Write-Host ('  gefunden in {0}' -f $store) -ForegroundColor Gray
    Write-Host ('    {0}' -f $hit.Subject)
    $fromStore += $hit
  }
}

if ($fromStore.Count -eq 0) {
  Write-Host '  Kein Zertifikat eines bekannten Inspektions-Proxys im Store.' -ForegroundColor Yellow
}

# --------------------------------------------------- 2. Kette vom Handshake ---

Write-Head ('2. Praesentierte Kette von {0} holen' -f $ReferenceHost)

$fromHandshake = @()
if ($useHandshake) {
  $fromHandshake = Get-PresentedChain -HostName $ReferenceHost
  foreach ($cert in $fromHandshake) {
    Write-Host ('  aus Handshake: {0}' -f $cert.Subject)
  }
  if ($fromHandshake.Count -eq 0) {
    Write-Host '  Keine Zwischenzertifikate ermittelt.' -ForegroundColor Yellow
  }
} else {
  Write-Host '  Uebersprungen: kein Zertifikatsfehler festgestellt.' -ForegroundColor DarkGray
}

# ------------------------------------------------------------ 3. Deduplizieren

Write-Head '3. Bundle zusammenstellen'

$all = @()
$all += $fromStore
$all += $fromHandshake

$unique = @{}
foreach ($cert in $all) {
  if ($null -eq $cert) { continue }
  if (-not $unique.ContainsKey($cert.Thumbprint)) {
    $unique[$cert.Thumbprint] = $cert
  }
}

if ($unique.Count -eq 0) {
  Write-Host ''
  Write-Host '  Nichts zu exportieren. Zwei moegliche Gruende:' -ForegroundColor Red
  Write-Host '   - Es findet keine TLS-Interception statt. Dann ist das Problem ein' -ForegroundColor Red
  Write-Host '     URL-Filter (Fall B), siehe docs/corporate-network.md.' -ForegroundColor Red
  Write-Host '   - Der Proxy heisst anders als im Suchmuster. Dann das Zertifikat im' -ForegroundColor Red
  Write-Host '     Browser (Schloss-Symbol) ansehen und den Namen im Muster ergaenzen.' -ForegroundColor Red
  exit 1
}

Write-Host ('  {0} eindeutige CA-Zertifikate.' -f $unique.Count) -ForegroundColor Green

$expired = $unique.Values | Where-Object { $_.NotAfter -lt (Get-Date) }
foreach ($e in $expired) {
  Write-Host ('  Warnung: abgelaufen am {0} - {1}' -f $e.NotAfter.ToString('yyyy-MM-dd'), $e.Subject) -ForegroundColor Yellow
}

$pem = ($unique.Values | ForEach-Object { ConvertTo-Pem -Certificate $_ }) -join "`n"

# ------------------------------------------------------------- 4. Schreiben ---

Write-Head '4. PEM-Bundle schreiben'

$dir = Split-Path -Parent $OutFile
if (-not (Test-Path $dir)) {
  if ($PSCmdlet.ShouldProcess($dir, 'Verzeichnis anlegen')) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
}

if ($PSCmdlet.ShouldProcess($OutFile, 'PEM-Bundle schreiben')) {
  # ASCII, damit kein BOM entsteht - Node stolpert sonst ueber das erste Zertifikat.
  Set-Content -Path $OutFile -Value $pem -Encoding ascii
  Write-Host ('  geschrieben: {0}' -f $OutFile) -ForegroundColor Green
}

# ------------------------------------------------------- 5. Variable setzen ---

Write-Head ('5. NODE_EXTRA_CA_CERTS setzen (Scope: {0})' -f $Scope)

if ($PSCmdlet.ShouldProcess('NODE_EXTRA_CA_CERTS', ('auf {0} setzen' -f $OutFile))) {
  [Environment]::SetEnvironmentVariable('NODE_EXTRA_CA_CERTS', $OutFile, $Scope)
  # Fuer die laufende Sitzung zusaetzlich direkt setzen, damit der Test unten greift.
  $env:NODE_EXTRA_CA_CERTS = $OutFile
  Write-Host ('  gesetzt: NODE_EXTRA_CA_CERTS={0}' -f $OutFile) -ForegroundColor Green
}

# ------------------------------------------------------------- 6. Gegentest ---

Write-Head '6. Gegentest mit Node'

$verifyJs = @'
const urls = process.argv.slice(2);
(async () => {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      console.log('  ok   ' + url + '  ->  HTTP ' + res.status);
    } catch (err) {
      const code = (err.cause && (err.cause.code || err.cause.message)) || err.code || err.message;
      console.log('  FEHL ' + url + '  ->  ' + code);
    }
  }
})();
'@

$verifyUrls = @(
  ('https://{0}/' -f $ReferenceHost)
  'https://registry.npmjs.org/next'
)

# $PSScriptRoot ist leer, wenn das Skript ueber Invoke-Expression laeuft - dann
# das Arbeitsverzeichnis nutzen.
$searchRoots = @()
if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
  $searchRoots += (Split-Path -Parent $PSScriptRoot)
  $searchRoots += $PSScriptRoot
}
$searchRoots += (Get-Location).Path

foreach ($root in ($searchRoots | Where-Object { $_ } | Select-Object -Unique)) {
  $envFile = Join-Path $root '.env.local'
  if (-not (Test-Path $envFile)) { continue }
  $line = Select-String -Path $envFile -Pattern '^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(\S+)' | Select-Object -First 1
  if ($null -eq $line) { continue }
  $value = $line.Matches[0].Groups[1].Value.Trim('"').Trim("'")
  if ($value -notmatch 'your-project') {
    $verifyUrls += ($value.TrimEnd('/') + '/rest/v1/')
    break
  }
}

$out = Invoke-NodeScript -Body $verifyJs -Arguments $verifyUrls
if ($null -eq $out) {
  Write-Host '  node nicht gefunden - Test uebersprungen.' -ForegroundColor Yellow
} else {
  Write-Host $out.TrimEnd()
}

Write-Head 'Fertig'
Write-Host '  HTTP 401 bei OpenAI und Supabase ist der Erfolgsfall: die Verbindung steht,'
Write-Host '  es fehlt nur der API-Key im Testaufruf.'
Write-Host ''
Write-Host '  Wichtig: Terminal, VS Code und alle laufenden next-Prozesse neu starten -'
Write-Host '  die Variable wird nur beim Prozessstart gelesen.'
Write-Host ''
Write-Host '  Bleiben Zertifikatsfehler, ist es kein CA-Problem: dann greift ein'
Write-Host '  URL-Filter. Siehe docs/corporate-network.md, Abschnitt "Fall B".'
Write-Host ''
