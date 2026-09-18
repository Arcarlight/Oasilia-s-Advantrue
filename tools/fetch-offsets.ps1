# Download PMD "Offsets" PNGs (they mark body center / head per frame) so we can
# determine which row of a sprite sheet faces which direction.
# Node's TLS trust store is broken in this sandbox, PowerShell works.
#
# Usage:  & tools/fetch-offsets.ps1
$ProgressPreference = 'SilentlyContinue'

$base = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $PSScriptRoot 'offsets-cache'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$meta = Get-Content (Join-Path $base 'assets\data\sprites.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$urlBase = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/'

$ok = 0; $skip = 0; $fail = 0
foreach ($slug in $meta.PSObject.Properties.Name) {
  $dex = $meta.$slug.dex
  foreach ($anim in $meta.$slug.anims.PSObject.Properties.Name) {
    $dst = Join-Path $out "$slug-$anim-Offsets.png"
    if ((Test-Path $dst) -and ((Get-Item $dst).Length -gt 100)) { $skip++; continue }
    $url = "$urlBase$dex/$anim-Offsets.png"
    try {
      Invoke-WebRequest -Uri $url -OutFile $dst -UseBasicParsing -TimeoutSec 60
      $ok++
    } catch {
      Write-Warning ("  x {0}/{1}: {2}" -f $slug, $anim, $_.Exception.Message)
      if (Test-Path $dst) { Remove-Item $dst -Force }
      $fail++
    }
  }
}
Write-Host ("offsets: new={0} skip={1} fail={2} -> {3}" -f $ok, $skip, $fail, $out)
