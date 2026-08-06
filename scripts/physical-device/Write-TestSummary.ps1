[CmdletBinding()]
param([Parameter(Mandatory)][string]$RunDirectory)
$common = Join-Path $PSScriptRoot 'lib\PhysicalDevice.Common.ps1'; . $common
$metadata = Read-RunMetadata $RunDirectory
$devicePath = Join-Path $RunDirectory 'adb-device-info.json'; $device = if (Test-Path $devicePath) { Get-Content -Raw $devicePath | ConvertFrom-Json } else { $null }
$screens = @($metadata.screenshots)
$timeline = @($metadata.timeline)
$filtered = Join-Path $RunDirectory 'adb-logcat-filtered.txt'
$logExcerpt = if (Test-Path $filtered) { (Get-Content $filtered | Select-Object -Last 20) -join "`n" } else { 'Unavailable' }
$tracePath = Join-Path $RunDirectory 'upload-trace.txt'
$traceSummary = if (Test-Path $tracePath) { (Get-Content $tracePath | Select-Object -Last 15) -join "`n" } else { 'Unavailable' }
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("# Physical Samsung test: $($metadata.testName)")
$lines.Add(''); $lines.Add("- Run ID: $($metadata.runId)"); $lines.Add("- Result: $($metadata.finalStatus)")
$lines.Add("- Picker source: $($metadata.pickerSource)"); $lines.Add("- Fixture: $($metadata.fixture)"); $lines.Add("- App URL: $($metadata.appUrl)")
$lines.Add("- Device: $(if($device){"$($device.manufacturer) $($device.model), Android $($device.androidVersion), serial $($device.serial)"}else{'Unknown'})")
$lines.Add("- Browser: $($metadata.browser) $($metadata.browserVersion)"); $lines.Add('')
$lines.Add('## Timeline'); $lines.Add(''); foreach ($event in $timeline) { $lines.Add("- $($event.timestamp) -- $($event.action)$(if($event.detail){": $($event.detail)"})") }
$lines.Add(''); $lines.Add('## Screenshots'); $lines.Add(''); foreach ($shot in $screens) { $lines.Add("- $($shot.number). [$($shot.stage)]($($shot.filename)) -- $($shot.capturedAt)") }
$lines.Add(''); $lines.Add('## Observed result'); $lines.Add(''); $lines.Add("Final route: $($metadata.finalRoute); error classification: $($metadata.errorClassification); candidate count: $($metadata.candidateCount); byte ownership: $($metadata.byteOwnershipSucceeded); crop required: $($metadata.cropRequired); proof reached: $($metadata.proofReached).")
$lines.Add(''); $lines.Add('## Upload trace summary'); $lines.Add(''); $lines.Add('```text'); $lines.Add($traceSummary); $lines.Add('```')
$lines.Add(''); $lines.Add('## Relevant Logcat excerpts'); $lines.Add(''); $lines.Add('```text'); $lines.Add($logExcerpt); $lines.Add('```')
$lines.Add(''); $lines.Add('## Operator notes'); $lines.Add(''); $lines.Add(($metadata.operatorNotes -join "`n")); $lines.Add('')
$lines.Add('## Next recommended debugging action'); $lines.Add(''); $lines.Add($(if($metadata.finalStatus -eq 'pass'){'Compare with the next picker source using the same fixture.'}else{'Compare browser-tab.json, upload-trace.txt, and adb-logcat-filtered.txt with a passing run.'}))
$path = Join-Path $RunDirectory 'run-summary.md'; $lines | Set-Content -LiteralPath $path -Encoding utf8
Write-Host "Summary: $path" -ForegroundColor Green
$path
