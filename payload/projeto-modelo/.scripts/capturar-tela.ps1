# Captures the real screen (or a crop of it) for visual validation.
# Usage:
#   powershell -NoProfile -File .scripts/capturar-tela.ps1 -Saida C:\path\print.png
#   powershell -NoProfile -File .scripts/capturar-tela.ps1 -Saida print.png -Recorte "0,880,3440,560"
#   powershell -NoProfile -File .scripts/capturar-tela.ps1 -Saida print.png -Reduzir 2   (half size, to fit for reading)
# Prints the saved path and the screen size. Does not open a window.
param(
  [Parameter(Mandatory = $true)][string]$Saida,
  [string]$Recorte = '',
  [int]$Reduzir = 1
)
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
$tela = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
if ($Recorte) {
  $p = $Recorte.Split(',') | ForEach-Object { [int]$_ }
  $x, $y, $w, $h = $p[0], $p[1], $p[2], $p[3]
} else { $x, $y, $w, $h = 0, 0, $tela.Width, $tela.Height }
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($x, $y, 0, 0, $bmp.Size)
if ($Reduzir -gt 1) {
  $menor = New-Object System.Drawing.Bitmap ([int]($w / $Reduzir)), ([int]($h / $Reduzir))
  $g2 = [System.Drawing.Graphics]::FromImage($menor)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g2.DrawImage($bmp, 0, 0, $menor.Width, $menor.Height)
  $menor.Save($Saida); $g2.Dispose(); $menor.Dispose()
} else { $bmp.Save($Saida) }
$g.Dispose(); $bmp.Dispose()
"saved: $Saida  (screen $($tela.Width)x$($tela.Height), crop $x,$y,$w,$h, reduced $Reduzir x)"
