param(
  [string]$OutputDir = "assets"
)

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path "."
$out = Join-Path $root $OutputDir
New-Item -ItemType Directory -Force -Path $out | Out-Null

$pngPath = Join-Path $out "icon.png"
$icoPath = Join-Path $out "icon.ico"
$size = 256
$bmp = New-Object System.Drawing.Bitmap $size, $size
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gfx.Clear([System.Drawing.Color]::Transparent)

function New-Brush($hex) {
  return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex))
}

$bgBrush = New-Brush "#075E54"
$greenBrush = New-Brush "#25D366"
$greenDarkBrush = New-Brush "#128C7E"
$whiteBrush = New-Brush "#FFFFFF"

$gfx.FillRectangle($bgBrush, 0, 0, $size, $size)

$circleRect = New-Object System.Drawing.Rectangle 38, 28, 180, 180
$gfx.FillEllipse($greenBrush, $circleRect)

$tail = New-Object System.Drawing.Drawing2D.GraphicsPath
$tail.AddPolygon([System.Drawing.Point[]]@(
  (New-Object System.Drawing.Point 72, 196),
  (New-Object System.Drawing.Point 88, 150),
  (New-Object System.Drawing.Point 126, 180)
))
$gfx.FillPath($greenBrush, $tail)

$outlinePen = New-Object System.Drawing.Pen $whiteBrush, 12
$gfx.DrawEllipse($outlinePen, 62, 56, 132, 132)
$tailPen = New-Object System.Drawing.Pen $whiteBrush, 10
$gfx.DrawLine($tailPen, 82, 178, 96, 154)
$gfx.DrawLine($tailPen, 82, 178, 113, 171)

$phonePen = New-Object System.Drawing.Pen $whiteBrush, 20
$phonePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$phonePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$phonePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$phonePath.AddBezier(90, 94, 108, 142, 138, 158, 166, 134)
$gfx.DrawPath($phonePen, $phonePath)

$cutBrush = New-Brush "#25D366"
$gfx.FillEllipse($cutBrush, 87, 88, 22, 26)
$gfx.FillEllipse($cutBrush, 151, 126, 26, 24)

$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$gfx.Dispose()
$bmp.Dispose()

$pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]1)
$bw.Write([Byte]0)
$bw.Write([Byte]0)
$bw.Write([Byte]0)
$bw.Write([Byte]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]32)
$bw.Write([UInt32]$pngBytes.Length)
$bw.Write([UInt32]22)
$bw.Write($pngBytes)
$bw.Close()
$fs.Close()

Write-Output "Generated $pngPath and $icoPath"
