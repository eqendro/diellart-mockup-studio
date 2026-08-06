Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Find-PhysicalTool {
  param([Parameter(Mandatory)][string]$Name, [string]$ExplicitPath, [string]$EnvironmentVariable)
  $candidates = [System.Collections.Generic.List[string]]::new()
  if ($ExplicitPath) { $candidates.Add($ExplicitPath) }
  if ($EnvironmentVariable) {
    $configured = [Environment]::GetEnvironmentVariable($EnvironmentVariable)
    if ($configured) { $candidates.Add($configured) }
  }
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { $candidates.Add($command.Source) }
  if ($Name -eq 'adb.exe' -or $Name -eq 'adb') {
    $candidates.Add((Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'))
    $candidates.Add('C:\platform-tools\adb.exe')
  }
  $searchRoots = @((Join-Path $env:USERPROFILE 'Downloads'), (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'))
  foreach ($root in $searchRoots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    $pattern = if ($Name -match '^adb') { 'adb.exe' } else { 'scrcpy.exe' }
    Get-ChildItem -LiteralPath $root -Depth 4 -File -Filter $pattern -ErrorAction SilentlyContinue |
      Select-Object -First 10 -ExpandProperty FullName | ForEach-Object { $candidates.Add($_) }
  }
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return (Resolve-Path -LiteralPath $candidate).Path }
  }
  return $null
}

function Resolve-AdbPath { param([string]$AdbPath) Find-PhysicalTool -Name 'adb.exe' -ExplicitPath $AdbPath -EnvironmentVariable 'SAMSUNG_ADB_PATH' }
function Resolve-ScrcpyPath { param([string]$ScrcpyPath) Find-PhysicalTool -Name 'scrcpy.exe' -ExplicitPath $ScrcpyPath -EnvironmentVariable 'SAMSUNG_SCRCPY_PATH' }

function Invoke-Adb {
  param([Parameter(Mandatory)][string]$AdbPath, [string]$Serial, [Parameter(Mandatory)][string[]]$Arguments)
  $all = [System.Collections.Generic.List[string]]::new()
  if ($Serial) { $all.Add('-s'); $all.Add($Serial) }
  foreach ($argument in $Arguments) { $all.Add($argument) }
  $output = & $AdbPath @all 2>&1
  if ($LASTEXITCODE -ne 0) { throw "adb failed ($LASTEXITCODE): $($output -join [Environment]::NewLine)" }
  return $output
}

function Get-AdbDeviceRows {
  param([Parameter(Mandatory)][string]$AdbPath)
  $lines = & $AdbPath devices -l 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Unable to run adb devices: $($lines -join ' ')" }
  $rows = @()
  foreach ($line in $lines | Select-Object -Skip 1) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split '\s+'
    $rows += [pscustomobject]@{ Serial = $parts[0]; State = $parts[1]; Detail = $line.Trim() }
  }
  return @($rows)
}

function Assert-OneAuthorisedDevice {
  param([Parameter(Mandatory)][string]$AdbPath)
  $rows = @(Get-AdbDeviceRows -AdbPath $AdbPath)
  if ($rows.Count -eq 0) { throw "No Android device detected. Connect USB, unlock the phone, enable USB debugging, accept the authorisation prompt, then run 'adb devices' again." }
  $blocked = @($rows | Where-Object State -ne 'device')
  if ($blocked.Count) {
    $states = ($blocked | ForEach-Object { "$($_.Serial)=$($_.State)" }) -join ', '
    throw "ADB device is not authorised/online ($states). Unlock the phone and accept the USB debugging prompt; reconnect USB if it is offline."
  }
  if ($rows.Count -ne 1) { throw "Expected exactly one physical device but found $($rows.Count): $(($rows.Serial) -join ', '). Disconnect extra devices/emulators or pass a clean ADB environment." }
  return $rows[0]
}

function ConvertTo-SafeName {
  param([Parameter(Mandatory)][string]$Value)
  $safe = $Value.ToLowerInvariant() -replace '[^a-z0-9]+','-'
  return $safe.Trim('-')
}

function New-UniqueRunDirectory {
  param([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$Name)
  New-Item -ItemType Directory -Path $Root -Force | Out-Null
  $stem = "{0}_{1}" -f (Get-Date -Format 'yyyy-MM-dd_HHmmss'), (ConvertTo-SafeName $Name)
  $candidate = Join-Path $Root $stem; $suffix = 1
  while (Test-Path -LiteralPath $candidate) { $candidate = Join-Path $Root "$stem-$suffix"; $suffix++ }
  New-Item -ItemType Directory -Path $candidate | Out-Null
  return (Resolve-Path -LiteralPath $candidate).Path
}

function Read-RunMetadata {
  param([Parameter(Mandatory)][string]$RunDirectory)
  $path = Join-Path $RunDirectory 'run-metadata.json'
  if (-not (Test-Path -LiteralPath $path)) { return [ordered]@{} }
  $metadata = ConvertTo-Hashtable (Get-Content -Raw -LiteralPath $path | ConvertFrom-Json)
  foreach ($field in @('timeline','screenshots','operatorNotes','unacceptableResults')) {
    if (-not $metadata.Contains($field) -or $null -eq $metadata[$field]) { $metadata[$field] = [object[]]@() }
    elseif ($metadata[$field] -is [System.Collections.IDictionary] -or $metadata[$field] -is [string]) { $metadata[$field] = [object[]]@($metadata[$field]) }
    else { $metadata[$field] = [object[]]@($metadata[$field]) }
  }
  return $metadata
}

function ConvertTo-Hashtable {
  param($InputObject)
  if ($null -eq $InputObject) { return $null }
  if ($InputObject -is [string] -or $InputObject -is [ValueType]) { return $InputObject }
  if ($InputObject -is [System.Collections.IDictionary]) {
    $result = [ordered]@{}; foreach ($key in $InputObject.Keys) { $result[$key] = ConvertTo-Hashtable $InputObject[$key] }; return $result
  }
  if ($InputObject -is [pscustomobject]) {
    $result = [ordered]@{}; foreach ($property in $InputObject.PSObject.Properties) { $result[$property.Name] = ConvertTo-Hashtable $property.Value }; return $result
  }
  if ($InputObject -is [System.Collections.IEnumerable] -and $InputObject -isnot [string]) {
    return @($InputObject | ForEach-Object { ConvertTo-Hashtable $_ })
  }
  return $InputObject
}

function Write-RunMetadata {
  param([Parameter(Mandatory)][string]$RunDirectory, [Parameter(Mandatory)]$Metadata)
  $path = Join-Path $RunDirectory 'run-metadata.json'
  $Metadata | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $path -Encoding utf8
  Get-Content -Raw -LiteralPath $path | ConvertFrom-Json | Out-Null
  return $path
}

function Add-RunTimelineEvent {
  param([Parameter(Mandatory)][string]$RunDirectory, [Parameter(Mandatory)][string]$Action, [string]$Detail)
  $metadata = Read-RunMetadata $RunDirectory
  if (-not $metadata.Contains('timeline')) { $metadata.timeline = @() }
  $metadata.timeline += [ordered]@{ timestamp = (Get-Date).ToUniversalTime().ToString('o'); action = $Action; detail = $Detail }
  Write-RunMetadata $RunDirectory $metadata | Out-Null
}

function Get-PackageVersion {
  param([string]$AdbPath, [string]$Serial, [string]$Package)
  try {
    $output = Invoke-Adb $AdbPath $Serial @('shell','dumpsys','package',$Package)
    $line = $output | Where-Object { $_ -match 'versionName=' } | Select-Object -First 1
    if ($line -match 'versionName=(.+)$') { return $Matches[1].Trim() }
  } catch { }
  return $null
}

function Show-OperatorActionMenu {
  param([string]$Stage)
  if ($Stage) { Write-Host "`nCurrent stage: $Stage" -ForegroundColor Cyan }
  Write-Host '[Enter] Capture standard stage'
  Write-Host '[A] Additional screenshot'
  Write-Host '[T] Paste upload trace'
  Write-Host '[N] Add note'
  Write-Host '[S] Set final status'
  Write-Host '[F] Finish run'
  Write-Host '[Q] Abort safely'
}

function Get-OperatorAction {
  param([AllowEmptyString()][string]$InputText)
  switch ($InputText.Trim().ToUpperInvariant()) {
    '' { return 'capture' }
    'A' { return 'additional' }
    'T' { return 'trace' }
    'N' { return 'note' }
    'S' { return 'status' }
    'F' { return 'finish' }
    'Q' { return 'abort' }
    default { return 'unknown' }
  }
}

function Test-LooksLikeUploadTrace {
  param([AllowEmptyString()][string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
  if ($Text -match '^[^\x00-\x7F]\s+') { return $true }
  return $Text -match '^\s*(Upload trace|analysis started|final route|change event fired|file metadata|session created|File\.arrayBuffer|FileReader|primary copy|fallback copy|upload state updated|recovery state entered)\s*:'
}

function Save-UploadTraceLines {
  param([Parameter(Mandatory)][string]$RunDirectory, [Parameter(Mandatory)][AllowEmptyCollection()][string[]]$Lines, [string]$Source = 'multiline operator input')
  New-Item -ItemType Directory -Path $RunDirectory -Force | Out-Null
  $path = Join-Path $RunDirectory 'upload-trace.txt'
  $content = [string]::Join([Environment]::NewLine, $Lines)
  [IO.File]::WriteAllText($path, $content, [Text.UTF8Encoding]::new($false))
  if (Test-Path -LiteralPath (Join-Path $RunDirectory 'run-metadata.json')) { Add-RunTimelineEvent $RunDirectory 'upload-trace-saved' "$Source; $($Lines.Count) lines" }
  return $path
}

function Read-MultilineUploadTrace {
  param([Parameter(Mandatory)][string]$RunDirectory, [scriptblock]$InputReader)
  if (-not $InputReader) { $InputReader = { Read-Host } }
  Write-Host "Upload-trace mode. Paste arbitrary trace text now." -ForegroundColor Cyan
  Write-Host "Enter ENDTRACE on a line by itself to save and return to the action menu."
  $lines = [System.Collections.Generic.List[string]]::new()
  $completed = $false
  try {
    while ($true) {
      $line = & $InputReader
      if ($null -eq $line) { throw [OperationCanceledException]::new('Upload-trace input ended before ENDTRACE. Partial run evidence was retained.') }
      if ($line -ceq 'ENDTRACE') { $completed = $true; break }
      $lines.Add([string]$line)
    }
  } finally {
    if (-not $completed -and $lines.Count -gt 0) {
      Save-UploadTraceLines -RunDirectory $RunDirectory -Lines $lines.ToArray() -Source 'interrupted multiline operator input' | Out-Null
    }
  }
  $path = Save-UploadTraceLines -RunDirectory $RunDirectory -Lines $lines.ToArray() -Source 'multiline operator input'
  Write-Host "Saved $($lines.Count) upload-trace lines to $path" -ForegroundColor Green
  return $path
}

function Import-UploadTraceFile {
  param([Parameter(Mandatory)][string]$RunDirectory, [Parameter(Mandatory)][string]$SourcePath)
  if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) { throw "Upload trace file does not exist: $SourcePath" }
  $destination = Join-Path $RunDirectory 'upload-trace.txt'
  [IO.File]::WriteAllBytes($destination, [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $SourcePath).Path))
  if (Test-Path -LiteralPath (Join-Path $RunDirectory 'run-metadata.json')) { Add-RunTimelineEvent $RunDirectory 'upload-trace-imported' (Resolve-Path -LiteralPath $SourcePath).Path }
  return $destination
}
