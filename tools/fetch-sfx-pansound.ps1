# Download sound effects from PANICPUMPKIN (pansound.com).
#
# License (https://www.pansound.com/panicpumpkin/music/kiyaku.html):
#   - free for any use including commercial games; modification allowed
#   - no usage report required; credit optional
#   - must NOT hotlink (we download the files into the project, which is what they ask for)
#   - must NOT redistribute the raw sound collection on its own
#
# Track list lives in tools/sfx-tracks.json so this script stays ASCII-only
# (Windows PowerShell 5.1 mis-reads UTF-8 files without a BOM).
#
# Usage:  & tools/fetch-sfx-pansound.ps1
$ProgressPreference = 'SilentlyContinue'

$base = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $base 'assets\audio\pansound'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$conf = Get-Content (Join-Path $PSScriptRoot 'sfx-tracks.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$wc = New-Object System.Net.WebClient
$wc.Headers.Add('User-Agent', 'Mozilla/5.0 (oasis-game asset fetch)')
$wc.Headers.Add('Referer', $conf.referer)

$ok = 0; $skip = 0; $fail = 0; $total = 0
foreach ($prop in $conf.tracks.PSObject.Properties) {
  $key   = $prop.Name
  $track = $prop.Value
  $dst   = Join-Path $out "$key.wav"
  if ((Test-Path $dst) -and ((Get-Item $dst).Length -gt 2000)) {
    $skip++; $total += (Get-Item $dst).Length
    Write-Host ("  = {0,-16} exists" -f $key)
    continue
  }
  try {
    $b = $wc.DownloadData($conf.baseUrl + $track.file)
    if ($b.Length -lt 2000) { throw "file too small ($($b.Length) bytes)" }
    [System.IO.File]::WriteAllBytes($dst, $b)
    $total += $b.Length
    $ok++
    Write-Host ("  + {0,-16} {1,5} KB  ({2})" -f $key, [math]::Round($b.Length/1KB), $track.name)
  } catch {
    Write-Warning ("  x {0} ({1}): {2}" -f $key, $track.file, $_.Exception.Message)
    if (Test-Path $dst) { Remove-Item $dst -Force }
    $fail++
  }
}
Write-Host ""
Write-Host ("pansound sfx: new={0} skip={1} fail={2} total={3} KB" -f $ok, $skip, $fail, [math]::Round($total/1KB))
