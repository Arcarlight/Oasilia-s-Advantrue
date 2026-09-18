# Download the icons that content/icons.json actually uses from Nieobie/Game-Icon-Pack (CC0 1.0).
#
# The upstream repo only ships SVG (there is no png/<name>.png; PNGs live in the release 7z),
# and every SVG is a single fill="currentColor" silhouette, so the game uses them as CSS masks.
#
# Only the icons listed in content/icons.json with source "pack:<component_name>" are fetched.
# Nothing is downloaded for "local:" entries (those are the existing Kenney PNGs in the repo).
#
# Idempotent / resumable: a file that already exists and looks like an SVG is skipped, so you can
# kill the script and run it again. Failed names are reported at the end with every mirror tried.
#
# ASCII only: this machine runs Windows PowerShell 5.1, which mis-reads UTF-8 .ps1 files without
# a BOM (it decodes them as GBK and can break string literals). Keep this file ASCII.
#
# Usage:
#   & tools/fetch-iconpack.ps1                  # download what is missing
#   & tools/fetch-iconpack.ps1 -Force           # re-download even if the file exists
#   & tools/fetch-iconpack.ps1 -LocalSvg <dir>  # copy from an already extracted repo instead
#                                               # (<dir> = .../game-icon-pack-main/svg)
param(
  [switch]$Force,
  [string]$LocalSvg = ''
)

$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Continue'

$base    = Split-Path -Parent $PSScriptRoot
$regPath = Join-Path $base 'content\icons.json'
$outDir  = Join-Path $base 'assets\img\icons\pack'

if (-not (Test-Path $regPath)) { Write-Host "ERROR: missing $regPath"; exit 1 }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Mirror chain. A is the official GitHub Pages site (verified 200, no mirror needed);
# B/B2 are gh-proxy front ends for raw.githubusercontent.com and were byte-identical to A.
$urlTemplates = @(
  'https://nieobie.github.io/game-icon-pack/svg/no-padding/{0}/{1}.svg',
  'https://ghproxy.net/https://raw.githubusercontent.com/Nieobie/game-icon-pack/main/svg/no-padding/{0}/{1}.svg',
  'https://gh-proxy.com/https://raw.githubusercontent.com/Nieobie/game-icon-pack/main/svg/no-padding/{0}/{1}.svg'
)

$reg   = Get-Content $regPath -Raw -Encoding UTF8 | ConvertFrom-Json
$icons = @($reg.icons | Where-Object { $_.source -like 'pack:*' })
if ($icons.Count -eq 0) { Write-Host 'No pack: entries in content/icons.json - nothing to do.'; exit 0 }

Write-Host ("Game-Icon-Pack: {0} pack icons registered in content/icons.json" -f $icons.Count)
Write-Host ("Output: {0}" -f $outDir)
if ($LocalSvg) { Write-Host ("Local source: {0}" -f $LocalSvg) }
Write-Host ''

$ok = 0; $skip = 0; $fail = 0; $bytes = 0
$failed = @()

function Test-SvgFile([string]$p) {
  if (-not (Test-Path $p)) { return $false }
  if ((Get-Item $p).Length -lt 80) { return $false }
  $head = Get-Content $p -TotalCount 1 -Encoding UTF8
  if ($null -eq $head) { return $false }
  return ($head -match '<svg')
}

foreach ($it in $icons) {
  $name = $it.name
  $comp = $it.source.Substring(5)
  $cat  = $it.category
  if (-not $cat) { $cat = 'unknown' }

  $file = $it.file
  if (-not $file) { $file = "icons/pack/$name.svg" }
  $dst = Join-Path (Join-Path $base 'assets\img') ($file -replace '/', '\')

  if ((Test-SvgFile $dst) -and (-not $Force)) {
    $skip++
    $bytes += (Get-Item $dst).Length
    continue
  }

  $saved = $false
  $tried = @()

  # 1) local already-extracted repo (fast path, e.g. the tarball from the scouting step)
  if ($LocalSvg) {
    $src = Join-Path $LocalSvg ("no-padding\{0}\{1}.svg" -f $cat, $comp)
    $tried += ("local:" + $src)
    if (Test-SvgFile $src) {
      Copy-Item $src $dst -Force
      $saved = $true
    }
  }

  # 2) mirror chain
  if (-not $saved) {
    foreach ($tpl in $urlTemplates) {
      $url = $tpl -f $cat, $comp
      $tried += $url
      $tmp = "$dst.part"
      try {
        Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -TimeoutSec 60 `
          -UserAgent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) fetch-iconpack.ps1' `
          -Headers @{ 'Accept' = 'image/svg+xml,*/*' }
        if (Test-SvgFile $tmp) {
          Move-Item $tmp $dst -Force
          $saved = $true
          break
        }
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
      } catch {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
      }
    }
  }

  if ($saved) {
    $ok++
    $bytes += (Get-Item $dst).Length
    Write-Host ("  ok    {0,-22} <- {1}" -f $name, $comp)
  } else {
    $fail++
    $failed += [pscustomobject]@{ name = $name; component = $comp; category = $cat; tried = $tried }
    Write-Host ("  FAIL  {0,-22} component={1} category={2}" -f $name, $comp, $cat)
  }
}

Write-Host ''
if ($fail -gt 0) {
  Write-Host ("FAILED {0} icon(s) - every mirror was tried:" -f $fail)
  foreach ($f in $failed) {
    Write-Host ("  {0}  (pack:{1}, category {2})" -f $f.name, $f.component, $f.category)
    foreach ($t in $f.tried) { Write-Host ("      tried: {0}" -f $t) }
  }
  Write-Host ''
  Write-Host 'If the network is the problem, grab the whole pack once (498 KB) and re-run with -LocalSvg:'
  Write-Host '  curl.exe -L -o "$env:TEMP\gip.tar.gz" "https://gh-proxy.com/https://codeload.github.com/Nieobie/game-icon-pack/tar.gz/refs/heads/main"'
  Write-Host '  tar.exe -xzf "$env:TEMP\gip.tar.gz" -C "$env:TEMP"'
  Write-Host '  & tools/fetch-iconpack.ps1 -LocalSvg "$env:TEMP\game-icon-pack-main\svg"'
  exit 1
}

Write-Host ("iconpack: new={0} skip={1} fail={2} total={3} KB -> {4}" -f $ok, $skip, $fail, [math]::Round($bytes / 1KB, 1), $outDir)
Write-Host 'Next: node tools/build-content.mjs   (regenerates the .ico-* block in src/ui/style.css)'
