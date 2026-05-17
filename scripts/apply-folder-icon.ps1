$desktopIni = Join-Path (Resolve-Path ".") "desktop.ini"

@"
[.ShellClassInfo]
IconResource=assets\icon.ico,0
IconFile=assets\icon.ico
IconIndex=0
"@ | Set-Content -Path $desktopIni -Encoding ASCII

attrib +s +h $desktopIni
attrib +r +s .

if (Test-Path "dist") {
  $distIni = Join-Path (Resolve-Path "dist") "desktop.ini"
  @"
[.ShellClassInfo]
IconResource=..\assets\icon.ico,0
IconFile=..\assets\icon.ico
IconIndex=0
"@ | Set-Content -Path $distIni -Encoding ASCII
  attrib +s +h $distIni
  attrib +r +s dist
}

Write-Output "Folder icons configured."
