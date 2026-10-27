# Extrai o APK do Oinc (e splits, se houver) de um Android conectado via USB.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\pull-oinc-apk.ps1

$ErrorActionPreference = 'Stop'
$package = 'br.com.useoinc.oincapp'
$outDir = Join-Path $PSScriptRoot '..\apk'

$adb = (Get-Command adb -ErrorAction SilentlyContinue).Source
if (-not $adb) {
    $adb = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Google.PlatformTools*" -Recurse -Filter adb.exe |
        Select-Object -First 1).FullName
}
if (-not $adb) { throw 'adb nao encontrado. Instale com: winget install Google.PlatformTools' }

$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\S' }
if (-not $devices) { throw 'Nenhum dispositivo conectado. Verifique o cabo e a depuracao USB.' }
if ($devices -match 'unauthorized') { throw 'Dispositivo nao autorizado. Aceite o aviso "Permitir depuracao USB" no celular.' }

$paths = & $adb shell pm path $package | ForEach-Object { $_ -replace '^package:', '' } | Where-Object { $_ }
if (-not $paths) { throw "Pacote $package nao instalado no dispositivo." }

New-Item -ItemType Directory -Force $outDir | Out-Null
foreach ($remote in $paths) {
    Write-Host "Extraindo $remote"
    & $adb pull $remote $outDir
}

$version = (& $adb shell dumpsys package $package | Select-String 'versionName=' | Select-Object -First 1).ToString().Trim()
Write-Host "`nConcluido ($version). Arquivos em: $((Resolve-Path $outDir).Path)"
Get-ChildItem $outDir -Filter *.apk | Format-Table Name, @{n='MB'; e={[math]::Round($_.Length / 1MB, 1)}}
