# Rebuilds gallery/images.json from the images in the gallery/ folder.
# Usage: drop photos into gallery/, run  .\update-gallery.ps1 , then git add/commit/push.
# Caption = filename with dashes/underscores turned into spaces.

$dir = Join-Path $PSScriptRoot "gallery"
New-Item -ItemType Directory -Force $dir | Out-Null

$exts = ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"
$items = Get-ChildItem $dir -File |
  Where-Object { $exts -contains $_.Extension.ToLower() } |
  Sort-Object LastWriteTime -Descending |
  ForEach-Object {
    [ordered]@{
      src   = "gallery/" + [uri]::EscapeDataString($_.Name)
      title = ($_.BaseName -replace '[-_]+', ' ')
    }
  }

$json = if ($items) { ConvertTo-Json @($items) } else { "[]" }
Set-Content (Join-Path $dir "images.json") $json -Encoding utf8
Write-Host ("Wrote {0} image(s) to gallery/images.json" -f @($items).Count)

$big = Get-ChildItem $dir -File | Where-Object { $_.Length -gt 2MB }
if ($big) { Write-Warning ("Over 2 MB (consider resizing): " + ($big.Name -join ", ")) }
