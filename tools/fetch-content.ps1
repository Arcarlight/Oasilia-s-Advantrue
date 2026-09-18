# Download PMD sprites + portraits for every species listed in content/species.json.
#
# This is the "one command to get all assets" script for the content pipeline:
#   content/species.json  ->  assets/pokemon/<slug>/{Idle,Attack,Hurt}.png
#                         ->  assets/portraits/<slug>/<Emotion>.png
#                         ->  assets/data/sprites.json  (frame metadata, via build-sprite-meta.mjs)
#
# It is idempotent: existing files (>100 bytes) are skipped, so re-running after
# adding a few species only downloads the new ones.
#
# Usage:  & tools/fetch-content.ps1
#         & tools/fetch-content.ps1 -SkipPortraits
#         & tools/fetch-content.ps1 -Only flygon,sceptile
#
# NOTE: keep this file ASCII-only. Windows PowerShell 5.1 mis-decodes UTF-8
# script files without a BOM, and CJK text in here would be mangled.
param(
  [switch]$SkipSprites,
  [switch]$SkipPortraits,
  [string]$Only = ''
)

$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Continue'

$base = Split-Path -Parent $PSScriptRoot
$speciesFile = Join-Path $base 'content\species.json'
$pokemonOut = Join-Path $base 'assets\pokemon'
$portraitOut = Join-Path $base 'assets\portraits'

if (-not (Test-Path $speciesFile)) { throw "missing $speciesFile" }

$json = Get-Content $speciesFile -Raw -Encoding UTF8 | ConvertFrom-Json
$all = @($json.species.PSObject.Properties)
$filter = @()
if ($Only -ne '') { $filter = $Only.Split(',') | ForEach-Object { $_.Trim() } }

# SpriteCollab lives on GitHub. raw.githubusercontent.com is sometimes unreachable from
# this machine (DNS / route issues), so we keep a list of mirrors and use whichever answers.
# The first one that works gets remembered, so we do not pay 3 failed attempts per file.
$RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/'
$MIRRORS = @(
  $RAW,
  'https://ghproxy.net/https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/',
  'https://gh-proxy.com/https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/',
  'https://ghfast.top/https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/'
)
$script:GoodBase = $null

function Get-SpriteFile {
  param([string]$RelPath, [string]$Dst)
  $bases = @()
  if ($script:GoodBase) { $bases += $script:GoodBase }
  foreach ($b in $MIRRORS) { if ($b -ne $script:GoodBase) { $bases += $b } }
  foreach ($b in $bases) {
    try {
      Invoke-WebRequest -Uri ($b + $RelPath) -OutFile $Dst -UseBasicParsing -TimeoutSec 60
      if ((Test-Path $Dst) -and ((Get-Item $Dst).Length -gt 60)) {
        if ($script:GoodBase -ne $b) {
          $script:GoodBase = $b
          Write-Host ("  (mirror in use: " + $b + ")")
        }
        return $true
      }
      throw "file too small"
    } catch {
      if (Test-Path $Dst) { Remove-Item $Dst -Force -ErrorAction SilentlyContinue }
    }
  }
  return $false
}

$spriteBase = 'sprite/'
$portraitBase = 'portrait/'
$animDataCache = Join-Path $PSScriptRoot 'animdata-cache'
New-Item -ItemType Directory -Force -Path $animDataCache | Out-Null
$anims = @('Idle', 'Attack', 'Hurt')
# Same list as src/core/portraits.js (SpriteCollab portrait file names)
$emotions = @('Normal', 'Happy', 'Joyous', 'Inspired', 'Determined', 'Angry',
              'Sad', 'Pain', 'Worried', 'Surprised', 'Shouting', 'Stunned',
              'Dizzy', 'Sigh', 'Crying', 'Teary-Eyed')

$spriteNew = 0; $spriteSkip = 0; $spriteFail = 0
$portNew = 0; $portSkip = 0; $portFail = 0
$failed = @()

foreach ($prop in $all) {
  $slug = $prop.Name
  if ($filter.Count -gt 0 -and ($filter -notcontains $slug)) { continue }
  $dex = $prop.Value.dex
  if (-not $dex) { Write-Warning "species $slug has no dex"; continue }

  if (-not $SkipSprites) {
    $dir = Join-Path $pokemonOut $slug
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    # AnimData.xml holds the per-animation frame size. Without it build-sprite-meta.mjs
    # can only treat the whole sheet as one frame, which renders the 8-direction sheet
    # as a single garbled frame.
    $animXml = Join-Path $animDataCache "$dex.xml"
    if (-not (Test-Path $animXml)) {
      if (-not (Get-SpriteFile "$spriteBase$dex/AnimData.xml" $animXml)) {
        Write-Warning ("  ! {0}: AnimData.xml failed (frame sizes will degrade)" -f $slug)
      }
    }
    foreach ($a in $anims) {
      $dst = Join-Path $dir "$a.png"
      if ((Test-Path $dst) -and ((Get-Item $dst).Length -gt 100)) { $spriteSkip++; continue }
      if (Get-SpriteFile "$spriteBase$dex/$a-Anim.png" $dst) { $spriteNew++ }
      else { $spriteFail++; $failed += "$slug/$a-Anim" }
    }
  }

  if (-not $SkipPortraits) {
    $dir = Join-Path $portraitOut $slug
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    foreach ($emo in $emotions) {
      $dst = Join-Path $dir "$emo.png"
      if ((Test-Path $dst) -and ((Get-Item $dst).Length -gt 100)) { $portSkip++; continue }
      if (Get-SpriteFile "$portraitBase$dex/$emo.png" $dst) { $portNew++ }
      else { $portFail++; $failed += "$slug/$emo" }
    }
  }

  Write-Host ("  {0,-14} dex={1}" -f $slug, $dex)
}

Write-Host ""
Write-Host ("sprites:   new={0} skip={1} fail={2}" -f $spriteNew, $spriteSkip, $spriteFail)
Write-Host ("portraits: new={0} skip={1} fail={2}" -f $portNew, $portSkip, $portFail)
if ($failed.Count -gt 0) {
  Write-Host ("failed files ({0}): {1}" -f $failed.Count, ($failed -join ', '))
}

# Rebuild frame metadata (assets/data/sprites.json) so the game knows frame sizes.
Write-Host ""
Write-Host "rebuilding assets/data/sprites.json ..."
Push-Location $base
node tools/build-sprite-meta.mjs
Pop-Location
