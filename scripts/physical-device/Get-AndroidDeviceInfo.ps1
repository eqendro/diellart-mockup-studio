[CmdletBinding()]
param([string]$AdbPath, [string]$Serial, [string]$OutputDirectory, [switch]$AsJson)
$common = Join-Path $PSScriptRoot 'lib\PhysicalDevice.Common.ps1'; . $common
$adb = Resolve-AdbPath $AdbPath
if (-not $adb) { throw 'adb was not found. Put adb on PATH, set SAMSUNG_ADB_PATH, or pass -AdbPath.' }
if (-not $Serial) { $Serial = (Assert-OneAuthorisedDevice $adb).Serial }
function Prop([string]$name) { ((Invoke-Adb $adb $Serial @('shell','getprop',$name)) -join '').Trim() }
function ShellText([string[]]$ShellArguments) { ((Invoke-Adb $adb $Serial (@('shell') + $ShellArguments)) -join "`n").Trim() }
$size = ShellText @('wm','size'); $density = ShellText @('wm','density')
$orientationText = ShellText @('dumpsys','input')
$orientation = if ($orientationText -match 'Viewport INTERNAL:[^\r\n]*orientation=(\d+)') { [int]$Matches[1] } elseif ($orientationText -match '(?m)^\s*Orientation:\s*(\d+)') { [int]$Matches[1] } else { $null }
$batteryText = ShellText @('dumpsys','battery')
$battery = if ($batteryText -match '(?m)^\s*level:\s*(\d+)') { [int]$Matches[1] } else { $null }
$info = [ordered]@{
  serial = $Serial; manufacturer = Prop 'ro.product.manufacturer'; model = Prop 'ro.product.model'
  product = Prop 'ro.product.name'; androidVersion = Prop 'ro.build.version.release'; sdkLevel = Prop 'ro.build.version.sdk'
  screenResolution = if($size -match 'Physical size:\s*([^\r\n]+)'){$Matches[1].Trim()}else{$size}; screenDensity = if($density -match 'Physical density:\s*([^\r\n]+)'){$Matches[1].Trim()}else{$density}
  orientation = $orientation; batteryLevel = $battery
  chrome = [ordered]@{ package = 'com.android.chrome'; version = Get-PackageVersion $adb $Serial 'com.android.chrome' }
  samsungInternet = [ordered]@{ package = 'com.sec.android.app.sbrowser'; version = Get-PackageVersion $adb $Serial 'com.sec.android.app.sbrowser' }
  capturedAt = (Get-Date).ToUniversalTime().ToString('o'); adbPath = $adb
}
if ($OutputDirectory) {
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  $info | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'adb-device-info.json') -Encoding utf8
  ($info.GetEnumerator() | ForEach-Object { if ($_.Value -is [System.Collections.IDictionary]) { "$($_.Key): $($_.Value.version)" } else { "$($_.Key): $($_.Value)" } }) |
    Set-Content -LiteralPath (Join-Path $OutputDirectory 'adb-device-info.txt') -Encoding utf8
}
if ($AsJson) { $info | ConvertTo-Json -Depth 6 } else { [pscustomobject]$info }
