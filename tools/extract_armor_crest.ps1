# extract_armor_crest.ps1 — sort le blason de l'Ile Solitaire de l'Armure de son
# paysage, et le depose detoure dans tools/.cache/.
#
# C'est la PREMIERE moitie de la fabrication de assets/img/dlc/ile-armure.png ;
# la seconde (recadrage sur la boite englobante et reduction a 96 px) est faite
# par crop_dlc_logos.ps1, qui relit le fichier ecrit ici. Le decoupage en deux
# scripts n'est pas cosmetique : ce script-ci parcourt 810 000 pixels dans des
# boucles PowerShell pures et met plusieurs minutes, alors que la reduction est
# instantanee. Les separer permet de rejouer la seconde autant qu'on veut — pour
# essayer une autre taille, une autre marge — sans repayer la premiere. D'ou le
# depot dans tools/.cache/ : c'est le dossier des intermediaires reconstructibles
# du depot, deja ignore par git.
#
# crop_logos.ps1 ne peut rien ici : il efface le blanc RELIE AU BORD, et ce
# logo-ci n'a pas de fond blanc mais une vue aerienne de Galar — ciel, mer,
# nuages, collines. Le remplissage depuis les bords devorerait tout ou rien.
#
# On separe donc par la COULEUR. Le dessin ne contient que deux teintes :
#   - le blason, un jaune d'or tres sature (R et G hauts, B bas) ;
#   - le texte, un brun presque noir, pose par-dessus.
# Le fond, lui, est bleu ou vert : jamais l'un ni l'autre.
#
# Puis un nettoyage par COMPOSANTE CONNEXE : le paysage contient des ombres
# sombres (les villes, les creux de vallee) qui passent le test « presque
# noir ». On ne garde donc que le plus gros amas d'un seul tenant — le blason
# et son texte se touchent, les taches parasites non.
#
# Usage :  powershell -ExecutionPolicy Bypass -File tools/extract_armor_crest.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$racine = Split-Path -Parent $PSScriptRoot
$src = Join-Path $racine "assets\img\sources\isle armor dlc logo.jpg"
$cache = Join-Path $PSScriptRoot ".cache"
if (-not (Test-Path $cache)) { New-Item -ItemType Directory -Path $cache | Out-Null }
$out = Join-Path $cache "armure-detoure.png"

$bmp = [System.Drawing.Bitmap]::FromFile($src)
$w = $bmp.Width; $h = $bmp.Height
"source : $w x $h"

$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$len = $data.Stride * $h
$buf = New-Object byte[] $len
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $len)
$bmp.UnlockBits($data)
$bmp.Dispose()

# --- 1. masque par couleur -------------------------------------------------
$garde = New-Object bool[] ($w * $h)
$nJaune = 0; $nSombre = 0
for ($y = 0; $y -lt $h; $y++) {
  $ligne = $y * $data.Stride
  for ($x = 0; $x -lt $w; $x++) {
    $i = $ligne + $x * 4
    $b = $buf[$i]; $g = $buf[$i+1]; $r = $buf[$i+2]
    # jaune d'or : rouge et vert hauts, bleu nettement plus bas
    $jaune = ($r -gt 150 -and $g -gt 110 -and $b -lt 130 -and ($r - $b) -gt 70 -and ($g - $b) -gt 40)
    # brun tres sombre du texte
    $sombre = ($r -lt 95 -and $g -lt 85 -and $b -lt 85)
    if ($jaune -or $sombre) { $garde[$y * $w + $x] = $true; if ($jaune) { $nJaune++ } else { $nSombre++ } }
  }
}
"pixels jaunes : $nJaune / pixels sombres : $nSombre"

# --- 2. plus grosse composante connexe -------------------------------------
$label = New-Object int[] ($w * $h)
$pile = New-Object int[] ($w * $h)
$tailles = @{}; $courant = 0
for ($p = 0; $p -lt ($w * $h); $p++) {
  if (-not $garde[$p] -or $label[$p] -ne 0) { continue }
  $courant++
  $n = 0; $sp = 0; $pile[$sp++] = $p; $label[$p] = $courant
  while ($sp -gt 0) {
    $q = $pile[--$sp]; $n++
    $qx = $q % $w; $qy = [int](($q - $qx) / $w)
    foreach ($d in @(@(1,0), @(-1,0), @(0,1), @(0,-1))) {
      $nx = $qx + $d[0]; $ny = $qy + $d[1]
      if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $w -or $ny -ge $h) { continue }
      $r2 = $ny * $w + $nx
      if ($garde[$r2] -and $label[$r2] -eq 0) { $label[$r2] = $courant; $pile[$sp++] = $r2 }
    }
  }
  $tailles[$courant] = $n
}
# SEUIL A 3000 PIXELS, et il ne doit rien au hasard : mesure faite, les amas
# gardes sont le blason (283 801 px) puis exactement trois lettres — le « o » de
# « of » (8172), le « o » d Armor (8179) et le « r » final (4527), tous poses
# hors du blason, sur le paysage, donc separes de lui. L amas suivant tombe a
# 2187 px et se trouve tout en bas de l image, dans les ombres des villes de
# Galar. Un facteur deux separe les lettres du bruit.
$SEUIL = 3000
$retenus = @($tailles.Keys | Where-Object { $tailles[$_] -ge $SEUIL })
"composantes : $courant"
"retenues   : $($retenus.Count)"
$retenus | ForEach-Object { "  amas $_ : $($tailles[$_]) px" }

# --- 3. ecriture + boite englobante ----------------------------------------
$minX = $w; $minY = $h; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $p = $y * $w + $x
    if ($retenus -notcontains $label[$p]) {
      $buf[$y * $data.Stride + $x * 4 + 3] = 0
    } else {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
"boite englobante : $minX,$minY -> $maxX,$maxY"

$plein = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$d2 = $plein.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
[System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $d2.Scan0, $len)
$plein.UnlockBits($d2)

$cw = $maxX - $minX + 1; $ch = $maxY - $minY + 1
$coupe = New-Object System.Drawing.Bitmap $cw, $ch, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gfx = [System.Drawing.Graphics]::FromImage($coupe)
$gfx.DrawImage($plein, (New-Object System.Drawing.Rectangle 0,0,$cw,$ch), (New-Object System.Drawing.Rectangle $minX,$minY,$cw,$ch), [System.Drawing.GraphicsUnit]::Pixel)
$gfx.Dispose()
$coupe.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
"ecrit : $out ($cw x $ch)"
$coupe.Dispose(); $plein.Dispose()
