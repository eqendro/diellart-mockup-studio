[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '..\lib\PhysicalDevice.Common.ps1')

function Assert-Equal {
  param($Expected, $Actual, [Parameter(Mandatory)][string]$Message)
  if ($Expected -cne $Actual) {
    throw "$Message`nExpected: <$Expected>`nActual:   <$Actual>"
  }
}

function Assert-True {
  param([bool]$Condition, [Parameter(Mandatory)][string]$Message)
  if (-not $Condition) { throw $Message }
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("diellart-harness-input-{0}" -f [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null

try {
  $check = [char]0x2713
  $errorSymbol = [char]0x2717
  $traceLines = @(
    "$check analysis started: filename.jpg",
    "$errorSymbol File.arrayBuffer rejected: NotReadableError",
    "$check final route: recoverable manual assistance",
    'text with spaces: and: multiple colons'
  )
  $queuedInput = [System.Collections.Generic.Queue[string]]::new()
  foreach ($line in $traceLines + 'ENDTRACE') { $queuedInput.Enqueue($line) }
  $reader = { $queuedInput.Dequeue() }

  $savedPath = Read-MultilineUploadTrace -RunDirectory $testRoot -InputReader $reader
  $expectedTrace = [string]::Join([Environment]::NewLine, $traceLines)
  $actualTrace = [IO.File]::ReadAllText($savedPath, [Text.Encoding]::UTF8)
  Assert-Equal $expectedTrace $actualTrace 'Multiline trace content, Unicode, spaces, colons, or line order changed.'
  Assert-Equal 0 $queuedInput.Count 'ENDTRACE did not complete multiline input at the sentinel.'
  Assert-True (Test-LooksLikeUploadTrace $traceLines[0]) 'Accidental Unicode trace paste was not detected.'
  Assert-True (Test-LooksLikeUploadTrace 'final route: recoverable manual assistance') 'Accidental textual trace paste was not detected.'
  Assert-True (-not (Test-LooksLikeUploadTrace 'A')) 'A normal screenshot command was misclassified as trace content.'

  $importSource = Join-Path $testRoot 'existing-trace-source.txt'
  $importText = "$check imported line: original`r`n$errorSymbol imported error: retained"
  [IO.File]::WriteAllText($importSource, $importText, [Text.UTF8Encoding]::new($false))
  $importRun = Join-Path $testRoot 'import-run'
  New-Item -ItemType Directory -Path $importRun | Out-Null
  $importedPath = Import-UploadTraceFile -RunDirectory $importRun -SourcePath $importSource
  Assert-True ([Linq.Enumerable]::SequenceEqual([IO.File]::ReadAllBytes($importSource), [IO.File]::ReadAllBytes($importedPath))) 'File-based trace import did not preserve source bytes.'

  Assert-Equal 'capture' (Get-OperatorAction '') 'Enter must select the standard screenshot action.'
  Assert-Equal 'additional' (Get-OperatorAction 'a') 'A must select the additional screenshot action.'
  Assert-Equal 'trace' (Get-OperatorAction 'T') 'T must enter multiline trace mode.'
  Assert-Equal 'unknown' (Get-OperatorAction 'pasted trace line') 'Arbitrary input must not become a screenshot action.'

  $interruptedRun = Join-Path $testRoot 'interrupted-run'
  $interruptedInput = [System.Collections.Generic.Queue[object]]::new()
  $interruptedInput.Enqueue("$check partial trace: retained")
  $interruptedInput.Enqueue($null)
  $interruptedReader = { $interruptedInput.Dequeue() }
  try {
    Read-MultilineUploadTrace -RunDirectory $interruptedRun -InputReader $interruptedReader | Out-Null
    throw 'Interrupted multiline input did not stop at end-of-input.'
  } catch [OperationCanceledException] { }
  Assert-Equal "$check partial trace: retained" ([IO.File]::ReadAllText((Join-Path $interruptedRun 'upload-trace.txt'))) 'Interrupted trace input did not preserve partial evidence.'

  Write-Host 'Physical-device operator input tests passed.' -ForegroundColor Green
} finally {
  if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
