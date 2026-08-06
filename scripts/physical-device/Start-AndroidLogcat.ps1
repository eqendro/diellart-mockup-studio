[CmdletBinding()]
param([Parameter(Mandatory)][string]$RunDirectory, [string]$AdbPath, [string]$Serial)
$common = Join-Path $PSScriptRoot 'lib\PhysicalDevice.Common.ps1'; . $common
$adb = Resolve-AdbPath $AdbPath; if (-not $adb) { throw 'adb was not found.' }
if (-not $Serial) { $Serial = (Assert-OneAuthorisedDevice $adb).Serial }
New-Item -ItemType Directory -Path $RunDirectory -Force | Out-Null
$raw = Join-Path $RunDirectory 'adb-logcat.txt'; $errors = Join-Path $RunDirectory 'adb-logcat-stderr.txt'
$process = Start-Process -FilePath $adb -ArgumentList @('-s',$Serial,'logcat','-v','threadtime','-T','1') -WindowStyle Hidden -PassThru -RedirectStandardOutput $raw -RedirectStandardError $errors
$state = [ordered]@{ processId = $process.Id; startedAt = (Get-Date).ToUniversalTime().ToString('o'); rawPath = $raw; stderrPath = $errors; adbPath = $adb; serial = $Serial }
$state | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $RunDirectory 'logcat-state.json') -Encoding utf8
Add-RunTimelineEvent $RunDirectory 'logcat-started' "PID $($process.Id)"
[pscustomobject]$state
