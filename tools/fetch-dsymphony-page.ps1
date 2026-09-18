# Find the Freezing Edge file links on d-symphony's material page and grab the terms of use.
# (Node's network stack is unreliable in this sandbox, so pull the pages with PowerShell
#  and parse them with Node afterwards. ASCII only: Windows PowerShell 5.1 mis-reads
#  UTF-8 .ps1 files without a BOM.)
$ProgressPreference = 'SilentlyContinue'
$wc = New-Object System.Net.WebClient
$wc.Headers.Add('User-Agent','Mozilla/5.0 (compatible; asset-check)')

$cache = Join-Path $PSScriptRoot 'dsymphony-cache'
New-Item -ItemType Directory -Force -Path $cache | Out-Null

foreach ($page in @('mt_00.html')) {
  $dst = Join-Path $cache $page
  if (-not (Test-Path $dst)) {
    try {
      $wc.DownloadFile("https://d-symphony.com/$page", $dst)
      Write-Host "downloaded $page"
    } catch { Write-Warning "fail $page : $($_.Exception.Message)"; continue }
  }
}
Write-Host "cache -> $cache"
