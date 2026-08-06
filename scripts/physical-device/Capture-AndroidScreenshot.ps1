[CmdletBinding()]
param([Parameter(Mandatory)][string]$RunDirectory, [Parameter(Mandatory)][string]$Stage, [string]$AdbPath, [string]$Serial)
$common = Join-Path $PSScriptRoot 'lib\PhysicalDevice.Common.ps1'; . $common
$adb = Resolve-AdbPath $AdbPath
if (-not $adb) { throw 'adb was not found.' }
if (-not $Serial) { $Serial = (Assert-OneAuthorisedDevice $adb).Serial }
New-Item -ItemType Directory -Path $RunDirectory -Force | Out-Null
$existing = @(Get-ChildItem -LiteralPath $RunDirectory -File -Filter '*.png' | Where-Object Name -Match '^\d{2,}-')
$number = [int]$(if ($existing.Count) { (($existing.Name | ForEach-Object { if ($_ -match '^(\d+)') { [int]$Matches[1] } } | Measure-Object -Maximum).Maximum + 1) } else { 1 })
$safeStage = ConvertTo-SafeName $Stage
$path = Join-Path $RunDirectory ('{0:D2}-{1}.png' -f $number, $safeStage)
$arguments = @('-s',$Serial,'exec-out','screencap','-p')
$process = Start-Process -FilePath $adb -ArgumentList $arguments -NoNewWindow -Wait -PassThru -RedirectStandardOutput $path
if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $path) -or (Get-Item -LiteralPath $path).Length -lt 8) { throw "Screenshot capture failed: $path" }
$signature = [System.IO.File]::ReadAllBytes($path)[0..7]
if (($signature -join ',') -ne '137,80,78,71,13,10,26,10') { throw "Screenshot is not a valid PNG: $path" }
$entry = [ordered]@{ number = $number; stage = $Stage; filename = (Split-Path $path -Leaf); capturedAt = (Get-Date).ToUniversalTime().ToString('o'); bytes = (Get-Item $path).Length }
$metadataPath = Join-Path $RunDirectory 'run-metadata.json'
if (Test-Path -LiteralPath $metadataPath) {
  $metadata = Read-RunMetadata $RunDirectory
  if (-not $metadata.Contains('screenshots')) { $metadata.screenshots = @() }
  $metadata.screenshots += $entry
  if (-not $metadata.Contains('timeline')) { $metadata.timeline = @() }
  $metadata.timeline += [ordered]@{ timestamp = $entry.capturedAt; action = 'screenshot'; detail = "$number $Stage" }
  Write-RunMetadata $RunDirectory $metadata | Out-Null
}
[pscustomobject]@{ Path = $path; Entry = $entry }
