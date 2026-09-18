$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $base 'assets\pokemon'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$species = @(
  '0330,flygon', '0331,cacnea', '0332,cacturne', '0333,swablu',
  '0111,rhyhorn', '0112,rhydon', '0027,sandshrew', '0028,sandslash',
  '0207,gligar', '0208,steelix', '0246,larvitar', '0247,pupitar',
  '0443,gible', '0444,gabite', '0445,garchomp', '0024,arbok',
  '0059,arcanine', '0142,aerodactyl', '0219,magcargo', '0066,machop',
  '0067,machoke', '0068,machamp', '0455,carnivine', '0718,zygarde',
  '0373,salamence', '0376,metagross'
)

$anims = @('Idle', 'Attack', 'Hurt')
$ok = 0; $fail = 0
foreach ($entry in $species) {
  $parts = $entry.Split(',')
  $id = $parts[0]; $slug = $parts[1]
  $dir = Join-Path $out $slug
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  foreach ($a in $anims) {
    $url = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/$id/$a-Anim.png"
    $dst = Join-Path $dir "$a.png"
    if (Test-Path $dst) { $ok++; continue }
    try {
      Invoke-WebRequest -Uri $url -OutFile $dst -UseBasicParsing -TimeoutSec 60
      $ok++
    } catch {
      Write-Warning "FAIL $slug/$a : $($_.Exception.Message)"
      $fail++
    }
  }
  Write-Host ("  " + $slug + " " + $id)
}
Write-Host "done. ok=$ok fail=$fail -> $out"
