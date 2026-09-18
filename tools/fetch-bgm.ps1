# Download the game's BGM from ontama-m (ongaku no tamago) into assets/audio/bgm.
#
# Since 2024 the game uses the **ogg(L)** version of every track: on the download
# pages "ogg(L)" is the file that is edited into a seamless natural loop
# ("ogg(L)" = seamless natural loop, "ogg(R)" = restart after the song ends,
# plain "ogg" = no loop). Those files are what makes the WebAudio buffer loop
# in src/core/bgm.js gapless.
#
# The track list lives in content/bgm.json (the content pipeline's single source
# of truth), so this script stays ASCII-only -- Windows PowerShell 5.1 mis-reads
# UTF-8 script files without a BOM and the Japanese titles would be mangled.
#
# The download URL of each ogg is NOT in content/bgm.json: the site names the
# ogg bundles after the *reading* of the Japanese title (cross.mp3 ->
# ontama_rpg_kurosujinkei_ogg.zip), so it cannot be derived from the mp3 name.
# Instead this script scrapes the category pages once and caches the
# mp3-name -> ogg-url mapping in tools/bgm-ogg-map.json. Add a track, run the
# script, and it re-scrapes only the names it does not know yet.
#
# Every key lands at assets/audio/bgm/<key>.ogg, which is what the generated
# BGM_FILES table in src/core/bgm.js expects.
#
# Usage:
#   & tools/fetch-bgm.ps1                 # download what is missing
#   & tools/fetch-bgm.ps1 -Force          # re-download everything
#   & tools/fetch-bgm.ps1 -Resolve        # only refresh the ogg url map
#   & tools/fetch-bgm.ps1 -Mp3            # legacy: fetch the mp3 instead
#   & tools/fetch-bgm.ps1 -RemoveMp3      # delete <key>.mp3 left over from before
param(
  [switch]$Resolve,
  [switch]$Mp3,
  [switch]$RemoveMp3,
  [switch]$Force
)

$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

$base = Split-Path -Parent $PSScriptRoot
$site = 'https://ontama-m.com/'
$out = Join-Path $base 'assets\audio\bgm'
$mapPath = Join-Path $PSScriptRoot 'bgm-ogg-map.json'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$confPath = Join-Path $base 'content\bgm.json'
if (-not (Test-Path $confPath)) { throw ("track list not found: " + $confPath) }
Write-Host ("track list: " + $confPath)
$conf = Get-Content $confPath -Raw -Encoding UTF8 | ConvertFrom-Json

# Every category page that lists mp3+ogg download pairs.
$pages = @(
  'ongaku_new.html',
  'ongaku_piano1.html', 'ongaku_piano2.html', 'ongaku_piano3.html',
  'ongaku_akarui.html', 'ongaku_kawaii.html', 'ongaku_uptempo.html',
  'ongaku_unique.html', 'ongaku_kurai.html', 'ongaku_soudai.html',
  'ongaku_orgel.html', 'ongaku_guitar.html', 'ongaku_others.html',
  'ongaku_rpg_theme.html', 'ongaku_rpg_prologue.html', 'ongaku_rpg_machi.html',
  'ongaku_rpg_renkin.html', 'ongaku_rpg_field.html', 'ongaku_rpg_dungeon.html',
  'ongaku_rpg_battle.html', 'ongaku_rpg_boss.html', 'ongaku_rpg_chara.html',
  'ongaku_rpg_others.html',
  'ongaku_c_piano.html', 'ongaku_c_orchestra.html', 'ongaku_c_orgel.html',
  'ongaku_c_others.html'
)

# The site is Shift_JIS. We only ever read ASCII hrefs out of it, but decoding
# with the right codepage keeps the row splitting intact.
function Get-PageText([string]$url) {
  $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 120
  $bytes = $r.RawContentStream.ToArray()
  $enc = [System.Text.Encoding]::GetEncoding('shift_jis')
  return $enc.GetString($bytes)
}

function Get-OggMap([hashtable]$into) {
  $map = $into
  if (-not $map) { $map = @{} }
  foreach ($p in $pages) {
    try { $h = Get-PageText ($site + $p) }
    catch {
      Write-Warning ("  scrape failed: {0} ({1})" -f $p, $_.Exception.Message)
      continue
    }
    $rows = [regex]::Matches($h, '(?s)<tr>(.*?)</tr>')
    $found = 0
    foreach ($row in $rows) {
      $b = $row.Groups[1].Value
      $m = [regex]::Match($b, 'href="([^"]*mp3_file/[^"]+\.mp3)"')
      $o = [regex]::Match($b, 'href="([^"]*ogg_file/[^"]+\.(?:ogg|zip))"')
      if ($m.Success -and $o.Success) {
        $mp3 = Split-Path $m.Groups[1].Value -Leaf
        $ogg = $o.Groups[1].Value -replace '^\./', ''
        if (-not $map.ContainsKey($mp3)) { $found++ }
        $map[$mp3] = $ogg
      }
    }
    Write-Host ("  scraped {0,-24} rows={1,-4} new={2,-3} map={3}" -f $p, $rows.Count, $found, $map.Count)
  }
  return $map
}

function Save-Map([hashtable]$map) {
  $obj = [ordered]@{}
  foreach ($k in ($map.Keys | Sort-Object)) { $obj[$k] = $map[$k] }
  $json = ($obj | ConvertTo-Json)
  [System.IO.File]::WriteAllText($mapPath, $json, (New-Object System.Text.UTF8Encoding($false)))
}

# ---- 1. mp3 name -> ogg url map ----
$map = @{}
if ((Test-Path $mapPath) -and -not $Resolve) {
  $cached = Get-Content $mapPath -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($pr in $cached.PSObject.Properties) { $map[$pr.Name] = $pr.Value }
  Write-Host ("ogg url map: " + $mapPath + " (" + $map.Count + " entries)")
}

$unknown = @()
foreach ($pr in $conf.tracks.PSObject.Properties) {
  $f = $pr.Value.file
  if ($f -and -not $map.ContainsKey($f)) { $unknown += $f }
}
if ($Resolve -or $unknown.Count -gt 0) {
  if ($unknown.Count -gt 0) { Write-Host ("resolving " + $unknown.Count + " unknown track(s): " + ($unknown -join ', ')) }
  Write-Host "scraping ontama-m category pages ..."
  $map = Get-OggMap $map
  Save-Map $map
  Write-Host ("ogg url map saved: " + $mapPath + " (" + $map.Count + " entries)")
} elseif (-not (Test-Path $mapPath)) {
  Write-Warning "no ogg url map available and nothing to resolve"
}

if ($Resolve) {
  Write-Host "resolve only, done."
  exit 0
}

# ---- 2. download ----
$ext = 'ogg'
if ($Mp3) { $ext = 'mp3' }
$url = $conf.baseUrl
$ok = 0; $skip = 0; $fail = 0; $gone = 0; $total = 0

foreach ($prop in $conf.tracks.PSObject.Properties) {
  $key = $prop.Name
  $track = $prop.Value
  $dst = Join-Path $out "$key.$ext"

  if ((Test-Path $dst) -and -not $Force -and ((Get-Item $dst).Length -gt 20000)) {
    Write-Host ("  = {0,-14} {1,6} KB (exists)" -f $key, [math]::Round((Get-Item $dst).Length / 1KB))
    $skip++; $total += (Get-Item $dst).Length
  } else {
    $done = $false
    for ($attempt = 1; $attempt -le 3 -and -not $done; $attempt++) {
      $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("ontama-" + $key + "." + $ext)
      try {
        if ($Mp3) {
          Invoke-WebRequest -Uri ($url + $track.file) -OutFile $dst -UseBasicParsing -TimeoutSec 300
        } else {
          $rel = $map[$track.file]
          if (-not $rel) { throw ("no ogg url known for " + $track.file) }
          $src = $site + $rel
          if ($rel -match '\.zip$') {
            # The site ships most ogg(L) files inside a zip whose entry name is the
            # Japanese title (and may be encoded Shift_JIS), so pick the entry by
            # extension instead of by name.
            Invoke-WebRequest -Uri $src -OutFile $tmp -UseBasicParsing -TimeoutSec 300
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $zip = [System.IO.Compression.ZipFile]::OpenRead($tmp)
            try {
              $entry = $null
              foreach ($e in $zip.Entries) { if ($e.FullName -match '\.ogg$') { $entry = $e; break } }
              if (-not $entry) { throw "no .ogg entry inside $rel" }
              [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dst, $true)
            } finally { $zip.Dispose() }
          } else {
            Invoke-WebRequest -Uri $src -OutFile $dst -UseBasicParsing -TimeoutSec 300
          }
        }

        $size = (Get-Item $dst).Length
        if ($size -lt 20000) { throw "file too small ($size bytes)" }
        if (-not $Mp3) {
          $fs = [System.IO.File]::OpenRead($dst)
          $hdr = New-Object byte[] 4
          $fs.Read($hdr, 0, 4) | Out-Null
          $fs.Close()
          $magic = [System.Text.Encoding]::ASCII.GetString($hdr)
          if ($magic -ne 'OggS') { throw "not an ogg stream (header=$magic)" }
        }
        Write-Host ("  + {0,-14} {1,6} KB  <- {2}" -f $key, [math]::Round($size / 1KB), $src)
        $ok++; $total += $size; $done = $true
      } catch {
        if (Test-Path $dst) { Remove-Item $dst -Force -ErrorAction SilentlyContinue }
        if ($attempt -eq 3) {
          Write-Warning ("  x {0} ({1}): {2}" -f $key, $track.file, $_.Exception.Message)
          $fail++
        } else {
          Write-Host ("    . {0} attempt {1} failed, retrying" -f $key, $attempt)
        }
      } finally {
        if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
      }
    }
  }

  # The old mp3 files are not referenced by any code any more; -RemoveMp3 cleans them up.
  if ($RemoveMp3 -and -not $Mp3) {
    $old = Join-Path $out "$key.mp3"
    if (Test-Path $old) { Remove-Item $old -Force; $gone++ }
  }
}

# ---- 3. manifest (provenance, so the licence is easy to look up later) ----
$tracks = [ordered]@{}
foreach ($prop in $conf.tracks.PSObject.Properties) {
  $key = $prop.Name
  $t = $prop.Value
  $entry = [ordered]@{
    file = "$key.$ext"
    source = $t.file
    name = $t.name
    use = $t.desc
  }
  if (-not $Mp3) { $entry.ogg = $map[$t.file] }
  $tracks[$key] = $entry
}
$manifest = [ordered]@{
  source = $conf.source
  license = $conf.license
  licenseUrl = $conf.licenseUrl
  loopNote = 'ogg(L) version: upstream edits these into a seamless natural loop; the game plays them with a WebAudio AudioBuffer loop'
  downloadedBy = 'tools/fetch-bgm.ps1'
  tracks = $tracks
}
$json = ($manifest | ConvertTo-Json -Depth 5)
[System.IO.File]::WriteAllText((Join-Path $out 'manifest.json'), $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host ("done: new={0} skip={1} fail={2} total={3} MB" -f $ok, $skip, $fail, [math]::Round($total / 1MB, 1))
if ($gone -gt 0) { Write-Host ("removed {0} mp3 file(s) that the game no longer uses" -f $gone) }
