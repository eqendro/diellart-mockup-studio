[CmdletBinding()]
param([Parameter(Mandatory)][string]$RunDirectory)
$common = Join-Path $PSScriptRoot 'lib\PhysicalDevice.Common.ps1'; . $common
$statePath = Join-Path $RunDirectory 'logcat-state.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Warning 'No Logcat state file found.'; return }
$state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
$process = Get-Process -Id $state.processId -ErrorAction SilentlyContinue
if ($process) { Stop-Process -Id $state.processId -ErrorAction SilentlyContinue; Wait-Process -Id $state.processId -Timeout 5 -ErrorAction SilentlyContinue }
$raw = Join-Path $RunDirectory 'adb-logcat.txt'; $filtered = Join-Path $RunDirectory 'adb-logcat-filtered.txt'
if (Test-Path -LiteralPath $raw) {
  Select-String -LiteralPath $raw -Pattern 'chromium|Chrome|SamsungBrowser|NotReadableError|file|provider|permission|WebView|console|JavaScript' -CaseSensitive:$false |
    ForEach-Object Line | Set-Content -LiteralPath $filtered -Encoding utf8
}
Add-RunTimelineEvent $RunDirectory 'logcat-stopped' "PID $($state.processId)"
Remove-Item -LiteralPath $statePath -Force
[pscustomobject]@{ ProcessId = $state.processId; RawPath = $raw; FilteredPath = $filtered; Stopped = $true }
