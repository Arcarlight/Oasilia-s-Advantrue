$ErrorActionPreference = 'Continue'
$base = Split-Path -Parent $PSScriptRoot
$cache = Join-Path $base 'tools\animdata-cache'
New-Item -ItemType Directory -Force -Path $cache | Out-Null

$ids = @('0330','0331','0332','0333','0111','0112','0027','0028','0207','0208',
         '0246','0247','0443','0444','0445','0024','0059','0142','0219','0066',
         '0067','0068','0455','0718','0373','0376')

foreach ($id in $ids) {
  $dst = Join-Path $cache "$id.xml"
  if (Test-Path $dst) { continue }
  try {
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/$id/AnimData.xml" -OutFile $dst -UseBasicParsing -TimeoutSec 60
    Write-Host "  ok $id"
  } catch {
    Write-Warning "FAIL $id : $($_.Exception.Message)"
  }
}
Write-Host "cached -> $cache"
