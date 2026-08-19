Add-Type -AssemblyName System.Drawing

$iconDirectory = Join-Path $PSScriptRoot '..\src-tauri\icons'
$iconDirectory = [System.IO.Path]::GetFullPath($iconDirectory)

$master = New-Object System.Drawing.Bitmap 512, 512
$graphics = [System.Drawing.Graphics]::FromImage($master)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$background = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(0, 53, 95))
$graphics.FillRectangle($background, 20, 20, 472, 472)
$accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(0, 166, 180))
$graphics.FillRectangle($accent, 20, 20, 472, 82)
$font = New-Object System.Drawing.Font('Segoe UI', 270, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString('E', $font, $textBrush, [System.Drawing.RectangleF]::new(0, 32, 512, 480), $format)
$graphics.Dispose()

function Save-Png([int]$size, [string]$name) {
  $image = New-Object System.Drawing.Bitmap $master, $size, $size
  $path = Join-Path $iconDirectory $name
  $image.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $image.Dispose()
}

Save-Png 32 '32x32.png'
Save-Png 128 '128x128.png'
Save-Png 256 '128x128@2x.png'
Save-Png 512 'icon.png'

$pngImages = @()
foreach ($size in 16, 32, 48, 128, 256) {
  $image = New-Object System.Drawing.Bitmap $master, $size, $size
  $memory = New-Object System.IO.MemoryStream
  $image.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngImages += [PSCustomObject]@{ Size = $size; Bytes = $memory.ToArray() }
  $memory.Dispose()
  $image.Dispose()
}

$iconPath = Join-Path $iconDirectory 'icon.ico'
$stream = [System.IO.File]::Open($iconPath, [System.IO.FileMode]::Create)
$writer = New-Object System.IO.BinaryWriter $stream
$writer.Write([UInt16]0); $writer.Write([UInt16]1); $writer.Write([UInt16]$pngImages.Count)
$offset = 6 + (16 * $pngImages.Count)
foreach ($entry in $pngImages) {
  $dimension = if ($entry.Size -eq 256) { 0 } else { $entry.Size }
  $writer.Write([Byte]$dimension); $writer.Write([Byte]$dimension); $writer.Write([Byte]0); $writer.Write([Byte]0)
  $writer.Write([UInt16]1); $writer.Write([UInt16]32); $writer.Write([UInt32]$entry.Bytes.Length); $writer.Write([UInt32]$offset)
  $offset += $entry.Bytes.Length
}
foreach ($entry in $pngImages) { $writer.Write($entry.Bytes) }
$writer.Dispose()

$font.Dispose(); $textBrush.Dispose(); $accent.Dispose(); $background.Dispose(); $master.Dispose()
