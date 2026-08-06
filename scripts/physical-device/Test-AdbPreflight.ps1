[CmdletBinding()]
param([string]$AdbPath, [string]$ScrcpyPath, [string]$OutputDirectory, [switch]$AsJson)
$common = Join-Path $PSScriptRoot 'lib\PhysicalDevice.Common.ps1'; . $common
$adb = Resolve-AdbPath $AdbPath
if (-not $adb) { throw 'ADB PREFLIGHT FAILED: adb was not found. Add platform-tools to PATH, set SAMSUNG_ADB_PATH, or pass -AdbPath <adb.exe>.' }
$version = ((& $adb version 2>&1) -join "`n").Trim()
$device = Assert-OneAuthorisedDevice $adb
$scrcpy = Resolve-ScrcpyPath $ScrcpyPath
$infoArgs = @{ AdbPath = $adb; Serial = $device.Serial; AsJson = $true }
if ($OutputDirectory) { $infoArgs.OutputDirectory = $OutputDirectory }
$deviceInfo = (& (Join-Path $PSScriptRoot 'Get-AndroidDeviceInfo.ps1') @infoArgs | ConvertFrom-Json)
$result = [ordered]@{ success = $true; adbPath = $adb; adbVersion = $version; device = $deviceInfo; scrcpyAvailable = [bool]$scrcpy; scrcpyPath = $scrcpy }
if ($AsJson) { $result | ConvertTo-Json -Depth 8 } else {
  Write-Host "ADB preflight passed: $($deviceInfo.manufacturer) $($deviceInfo.model) [$($deviceInfo.serial)]" -ForegroundColor Green
  Write-Host "Android $($deviceInfo.androidVersion), SDK $($deviceInfo.sdkLevel), screen $($deviceInfo.screenResolution), battery $($deviceInfo.batteryLevel)%"
  Write-Host "ADB: $adb"; Write-Host "scrcpy: $(if($scrcpy){$scrcpy}else{'not found (optional)'})"
  [pscustomobject]$result
}
