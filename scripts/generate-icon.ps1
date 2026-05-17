param(
  [string]$OutputDir = "assets"
)

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path "."
$out = Join-Path $root $OutputDir
New-Item -ItemType Directory -Force -Path $out | Out-Null

$pngPath = Join-Path $out "icon.png"
$icoPath = Join-Path $out "icon.ico"
$sizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)

function New-Brush($hex) {
  return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function New-Pen($brush, $width) {
  $pen = New-Object System.Drawing.Pen $brush, $width
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function Draw-Icon($size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $gfx.Clear([System.Drawing.Color]::Transparent)

  $greenBrush = New-Brush "#25D366"
  $whiteBrush = New-Brush "#FFFFFF"
  $cutBrush = New-Brush "#25D366"

  $scale = $size / 256.0
  $circle = New-Object System.Drawing.RectangleF (40*$scale), (28*$scale), (176*$scale), (176*$scale)
  $gfx.FillEllipse($greenBrush, $circle)

  $tail = New-Object System.Drawing.Drawing2D.GraphicsPath
  $tail.AddPolygon([System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF (70*$scale), (210*$scale)),
    (New-Object System.Drawing.PointF (88*$scale), (158*$scale)),
    (New-Object System.Drawing.PointF (132*$scale), (188*$scale))
  ))
  $gfx.FillPath($greenBrush, $tail)

  $outlinePen = New-Pen $whiteBrush ([Math]::Max(2, 13*$scale))
  $gfx.DrawEllipse($outlinePen, (62*$scale), (51*$scale), (132*$scale), (132*$scale))
  $tailPen = New-Pen $whiteBrush ([Math]::Max(2, 10*$scale))
  $gfx.DrawLine($tailPen, (82*$scale), (184*$scale), (97*$scale), (156*$scale))
  $gfx.DrawLine($tailPen, (82*$scale), (184*$scale), (116*$scale), (176*$scale))

  $phonePen = New-Pen $whiteBrush ([Math]::Max(3, 18*$scale))
  $phonePath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $phonePath.AddBezier((91*$scale), (96*$scale), (108*$scale), (138*$scale), (139*$scale), (158*$scale), (166*$scale), (132*$scale))
  $gfx.DrawPath($phonePen, $phonePath)

  if ($size -ge 32) {
    $gfx.FillEllipse($cutBrush, (86*$scale), (87*$scale), (23*$scale), (27*$scale))
    $gfx.FillEllipse($cutBrush, (150*$scale), (125*$scale), (27*$scale), (25*$scale))
  }

  $gfx.Dispose()
  return $bmp
}

$large = Draw-Icon 256
$large.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$large.Dispose()

$entries = @()
foreach ($size in $sizes) {
  $bmp = Draw-Icon $size
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $entries += [PSCustomObject]@{
    Size = $size
    Bytes = $ms.ToArray()
  }
  $ms.Dispose()
  $bmp.Dispose()
}

$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$entries.Count)

$offset = 6 + ($entries.Count * 16)
foreach ($entry in $entries) {
  $bw.Write([Byte]($(if ($entry.Size -eq 256) { 0 } else { $entry.Size })))
  $bw.Write([Byte]($(if ($entry.Size -eq 256) { 0 } else { $entry.Size })))
  $bw.Write([Byte]0)
  $bw.Write([Byte]0)
  $bw.Write([UInt16]1)
  $bw.Write([UInt16]32)
  $bw.Write([UInt32]$entry.Bytes.Length)
  $bw.Write([UInt32]$offset)
  $offset += $entry.Bytes.Length
}

foreach ($entry in $entries) {
  $bw.Write($entry.Bytes)
}

$bw.Close()
$fs.Close()

Write-Output "Generated transparent multi-size icon: $pngPath and $icoPath"
