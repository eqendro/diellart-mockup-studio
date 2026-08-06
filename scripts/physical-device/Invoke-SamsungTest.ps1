[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]*$')][string]$Name,
  [ValidateSet('Google Photos','Android Files','Samsung Gallery','Camera','Other')][string]$PickerSource,
  [string]$Fixture,
  [ValidatePattern('^https?://')][string]$AppUrl,
  [string]$Notes,
  [string]$BrowserPackage = 'com.sec.android.app.sbrowser',
  [switch]$StartScrcpy,
  [string[]]$ScreenshotStages = @('initial','picker-opened','picker-returned','processing','crop-or-review','final'),
  [ValidateRange(10,3600)][int]$TimeoutSeconds = 600,
  [string]$AdbPath,
  [string]$ScrcpyPath,
  [string]$UploadTraceFile,
  [switch]$NonInteractive,
  [switch]$SimulateAbort
)
$common = Join-Path $PSScriptRoot 'lib\PhysicalDevice.Common.ps1'; . $common
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$scenarioPath = Join-Path $PSScriptRoot 'test-cases.json'
$scenarioData = Get-Content -Raw -LiteralPath $scenarioPath | ConvertFrom-Json
$scenario = $scenarioData | Where-Object { $_.name -eq $Name } | Select-Object -First 1
if (-not $PickerSource -and $scenario) { $PickerSource = $scenario.pickerSource }
if (-not $Fixture -and $scenario) { $Fixture = $scenario.fixture }
if (-not $AppUrl) { $AppUrl = 'http://192.168.100.31:3000/?debugUpload=1' }
if (-not $PickerSource -or -not $Fixture) { throw 'PickerSource and Fixture are required unless Name matches a preset in test-cases.json.' }
$root = Join-Path $repoRoot 'test-results\physical-samsung'
$runDirectory = New-UniqueRunDirectory $root $Name
$start = (Get-Date).ToUniversalTime().ToString('o')
$metadata = [ordered]@{
  runId = Split-Path $runDirectory -Leaf; testName = $Name; startTimestamp = $start; endTimestamp = $null
  deviceSerial = $null; model = $null; androidVersion = $null; browser = $BrowserPackage; browserVersion = $null
  appUrl = $AppUrl; pickerSource = $PickerSource; fixture = $Fixture; operatorNotes = [object[]]@($(if($Notes){$Notes}))
  expectedBroadRoute = if($scenario){$scenario.expectedBroadRoute}else{$null}; unacceptableResults = [object[]]@($(if($scenario){$scenario.unacceptable | ForEach-Object { $_.ToString() }}))
  screenshots = [object[]]@(); timeline = [object[]]@([ordered]@{ timestamp = $start; action = 'run-started'; detail = $Name })
  logcatPath = 'adb-logcat.txt'; browserConsolePath = 'browser-console.txt'; uploadTracePath = 'upload-trace.txt'
  finalRoute = $null; finalStatus = 'in-progress'; errorClassification = $null; candidateCount = $null
  byteOwnershipSucceeded = $null; cropRequired = $null; proofReached = $null; aborted = $false
}
Write-RunMetadata $runDirectory $metadata | Out-Null
if ($UploadTraceFile) { Import-UploadTraceFile -RunDirectory $runDirectory -SourcePath $UploadTraceFile | Out-Null }
$logcatStarted = $false
try {
  $preflight = & (Join-Path $PSScriptRoot 'Test-AdbPreflight.ps1') -AdbPath $AdbPath -ScrcpyPath $ScrcpyPath -OutputDirectory $runDirectory -AsJson | ConvertFrom-Json
  $adb = $preflight.adbPath; $serial = $preflight.device.serial
  $metadata = Read-RunMetadata $runDirectory; $metadata.deviceSerial = $serial; $metadata.model = $preflight.device.model; $metadata.androidVersion = $preflight.device.androidVersion
  $metadata.browserVersion = if($BrowserPackage -eq 'com.android.chrome'){$preflight.device.chrome.version}else{$preflight.device.samsungInternet.version}
  Write-RunMetadata $runDirectory $metadata | Out-Null
  if ($StartScrcpy) {
    $scrcpy = Resolve-ScrcpyPath $ScrcpyPath
    if (-not $scrcpy) { Write-Warning 'scrcpy was requested but not found. The run will continue with ADB evidence capture.' }
    elseif (-not (Get-Process -Name scrcpy -ErrorAction SilentlyContinue)) { Start-Process -FilePath $scrcpy -ArgumentList @('-s',$serial) | Out-Null; Add-RunTimelineEvent $runDirectory 'scrcpy-started' $scrcpy }
    else { Add-RunTimelineEvent $runDirectory 'scrcpy-already-running' 'Existing process retained' }
  }
  & (Join-Path $PSScriptRoot 'Start-AndroidLogcat.ps1') -RunDirectory $runDirectory -AdbPath $adb -Serial $serial | Out-Null; $logcatStarted = $true
  Invoke-Adb $adb $serial @('shell','am','start','-a','android.intent.action.VIEW','-d',$AppUrl,'-p',$BrowserPackage) | Out-Null
  Add-RunTimelineEvent $runDirectory 'app-url-opened' $AppUrl
  if ($SimulateAbort) { throw [OperationCanceledException]::new('Simulated operator interruption for harness verification.') }
  Write-Host "`nPhysical Samsung run: $Name" -ForegroundColor Cyan
  Write-Host "Fixture: $Fixture | Picker: $PickerSource"
  Write-Host "Evidence: $runDirectory`n" -ForegroundColor Yellow
  if ($NonInteractive) {
    & (Join-Path $PSScriptRoot 'Capture-AndroidScreenshot.ps1') -RunDirectory $runDirectory -Stage 'initial' -AdbPath $adb -Serial $serial | Out-Null
  } else {
    $stageIndex = 0; $finishRequested = $false; $tracePasteWarningShown = $false
    while (-not $finishRequested) {
      $stage = if ($stageIndex -lt $ScreenshotStages.Count) { $ScreenshotStages[$stageIndex] } else { $null }
      Show-OperatorActionMenu -Stage $(if($stage){$stage}else{'All standard stages captured'})
      $choice = Read-Host 'Action'
      $action = Get-OperatorAction $choice
      switch ($action) {
        'capture' {
          if ($stage) { & (Join-Path $PSScriptRoot 'Capture-AndroidScreenshot.ps1') -RunDirectory $runDirectory -Stage $stage -AdbPath $adb -Serial $serial | Out-Null; $stageIndex++ }
          else { Write-Host 'All standard stages are captured. Use A for another screenshot or F to finish.' }
          $tracePasteWarningShown = $false
        }
        'additional' { $label = Read-Host 'Additional screenshot label'; & (Join-Path $PSScriptRoot 'Capture-AndroidScreenshot.ps1') -RunDirectory $runDirectory -Stage $label -AdbPath $adb -Serial $serial | Out-Null; $tracePasteWarningShown = $false }
        'trace' { Read-MultilineUploadTrace -RunDirectory $runDirectory | Out-Null; $tracePasteWarningShown = $false }
        'note' { $note = Read-Host 'Note'; $m = Read-RunMetadata $runDirectory; $m.operatorNotes += $note; Write-RunMetadata $runDirectory $m | Out-Null; Add-RunTimelineEvent $runDirectory 'operator-note' $note; $tracePasteWarningShown = $false }
        'status' {
          $status = Read-Host 'Final status (pass/fail/needs-review)'
          if ($status -notin @('pass','fail','needs-review')) { Write-Host 'Status must be pass, fail, or needs-review.' } else { $m = Read-RunMetadata $runDirectory; $m.finalStatus = $status; Write-RunMetadata $runDirectory $m | Out-Null; Add-RunTimelineEvent $runDirectory 'final-status-set' $status }
          $tracePasteWarningShown = $false
        }
        'finish' { Add-RunTimelineEvent $runDirectory 'operator-finished' 'F'; $finishRequested = $true; $tracePasteWarningShown = $false }
        'abort' { throw [OperationCanceledException]::new('Operator aborted the run.') }
        default {
          if (Test-LooksLikeUploadTrace $choice) {
            if (-not $tracePasteWarningShown) { Write-Host 'This looks like upload-trace content. Enter T first, then paste the trace.' -ForegroundColor Yellow }
            $tracePasteWarningShown = $true
          } else {
            Write-Host "Unknown action: '$choice'" -ForegroundColor Yellow
            Show-OperatorActionMenu -Stage $(if($stage){$stage}else{'All standard stages captured'})
            $tracePasteWarningShown = $false
          }
        }
      }
    }
  }
  & (Join-Path $PSScriptRoot 'Get-ChromeDebugInfo.ps1') -RunDirectory $runDirectory -AppUrl $AppUrl -AdbPath $adb -Serial $serial | Out-Null
  $metadata = Read-RunMetadata $runDirectory
  if ($metadata.finalStatus -eq 'in-progress') { $metadata.finalStatus = 'needs-review' }
  $metadata.endTimestamp = (Get-Date).ToUniversalTime().ToString('o'); Write-RunMetadata $runDirectory $metadata | Out-Null
} catch [OperationCanceledException] {
  $metadata = Read-RunMetadata $runDirectory; $metadata.aborted = $true; $metadata.finalStatus = 'needs-review'; $metadata.endTimestamp = (Get-Date).ToUniversalTime().ToString('o'); $metadata.operatorNotes += $_.Exception.Message; Write-RunMetadata $runDirectory $metadata | Out-Null
  Write-Warning $_.Exception.Message
} catch {
  $metadata = Read-RunMetadata $runDirectory; $metadata.finalStatus = 'needs-review'; $metadata.endTimestamp = (Get-Date).ToUniversalTime().ToString('o'); $metadata.operatorNotes += "Harness error: $($_.Exception.Message)"; Write-RunMetadata $runDirectory $metadata | Out-Null
  Write-Error $_
} finally {
  if ($logcatStarted) { & (Join-Path $PSScriptRoot 'Stop-AndroidLogcat.ps1') -RunDirectory $runDirectory | Out-Null }
  & (Join-Path $PSScriptRoot 'Write-TestSummary.ps1') -RunDirectory $runDirectory | Out-Null
  Write-Host "`nEvidence folder: $runDirectory" -ForegroundColor Green
}
