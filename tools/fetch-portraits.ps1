# Download PMD portrait images (emotion portraits) for every species used by the game.
# SpriteCollab keeps them in portrait/<dex>/<Emotion>.png -- 16 emotions per species,
# each only ~1.8 KB, so grabbing all of them costs about 1 MB.
#
# ASCII only: Windows PowerShell 5.1 mis-reads UTF-8 .ps1 files without a BOM.
# (Superseded by tools/fetch-content.ps1, which does sprites + AnimData + portraits.)
#
# Usage:  & tools/fetch-portraits.ps1
$ProgressPreference = 'SilentlyContinue'

$base = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $base 'assets\portraits'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$meta = Get-Content (Join-Path $base 'assets\data\sprites.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$urlBase = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/'

$emotions = @('Normal', 'Happy', 'Joyous', 'Inspired', 'Determined', 'Angry',
              'Sad', 'Pain', 'Worried', 'Surprised', 'Shouting', 'Stunned',
              'Dizzy', 'Sigh', 'Crying', 'Teary-Eyed')

$ok = 0; $skip = 0; $fail = 0; $bytes = 0

foreach ($slug in $meta.PSObject.Properties.Name) {
  $dex = $meta.$slug.dex
  $dir = Join-Path $out $slug
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  foreach ($emo in $emotions) {
    $dst = Join-Path $dir "$emo.png"
    if ((Test-Path $dst) -and ((Get-Item $dst).Length -gt 100)) { $skip++; $bytes += (Get-Item $dst).Length; continue }
    try {
      Invoke-WebRequest -Uri "$urlBase$dex/$emo.png" -OutFile $dst -UseBasicParsing -TimeoutSec 60
      $bytes += (Get-Item $dst).Length
      $ok++
    } catch {
      if (Test-Path $dst) { Remove-Item $dst -Force }
      $fail++
    }
  }
  Write-Host ("  {0,-12} done" -f $slug)
}

Write-Host ""
Write-Host ("portraits: new={0} skip={1} fail={2} total={3} KB -> {4}" -f $ok, $skip, $fail, [math]::Round($bytes/1KB), $out)
