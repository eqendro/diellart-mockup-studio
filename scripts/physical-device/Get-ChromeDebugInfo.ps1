[CmdletBinding()]
param([Parameter(Mandatory)][string]$RunDirectory, [Parameter(Mandatory)][string]$AppUrl, [string]$AdbPath, [string]$Serial)
$common = Join-Path $PSScriptRoot 'lib\PhysicalDevice.Common.ps1'; . $common
$adb = Resolve-AdbPath $AdbPath; if (-not $adb) { throw 'adb was not found.' }
if (-not $Serial) { $Serial = (Assert-OneAuthorisedDevice $adb).Serial }
New-Item -ItemType Directory -Path $RunDirectory -Force | Out-Null
$result = [ordered]@{ available = $false; socket = $null; localPort = $null; matchingTab = $null; userAgent = $null; error = $null; capturedAt = (Get-Date).ToUniversalTime().ToString('o') }
$consolePath = Join-Path $RunDirectory 'browser-console.txt'; $tracePath = Join-Path $RunDirectory 'upload-trace.txt'
function Invoke-CdpExpression([string]$WebSocketUrl, [string]$Expression) {
  $socket = [System.Net.WebSockets.ClientWebSocket]::new()
  $token = [Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(5))
  try {
    $socket.ConnectAsync([Uri]$WebSocketUrl, $token.Token).GetAwaiter().GetResult()
    $request = @{ id = 1; method = 'Runtime.evaluate'; params = @{ expression = $Expression; returnByValue = $true } } | ConvertTo-Json -Compress -Depth 5
    $bytes = [Text.Encoding]::UTF8.GetBytes($request)
    $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, $token.Token).GetAwaiter().GetResult()
    $buffer = New-Object byte[] 1048576; $stream = [IO.MemoryStream]::new()
    do {
      $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $token.Token).GetAwaiter().GetResult()
      $stream.Write($buffer, 0, $received.Count)
    } while (-not $received.EndOfMessage)
    $response = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
    return $response.result.result.value
  } finally {
    if ($socket.State -eq [Net.WebSockets.WebSocketState]::Open) { $socket.CloseAsync([Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', [Threading.CancellationToken]::None).GetAwaiter().GetResult() }
    $socket.Dispose(); $token.Dispose()
  }
}
try {
  $sockets = Invoke-Adb $adb $Serial @('shell','cat','/proc/net/unix')
  $socketLine = $sockets | Where-Object { $_ -match '@(chrome_devtools_remote|webview_devtools_remote[^\s]*)' } | Select-Object -First 1
  if (-not $socketLine) { throw 'No Chrome/WebView DevTools socket is exposed. Enable USB debugging and Chrome remote debugging, or continue with manual trace capture.' }
  $socketName = ([regex]::Match($socketLine, '@([^\s]+)$')).Groups[1].Value
  $portText = (Invoke-Adb $adb $Serial @('forward','tcp:0',"localabstract:$socketName") | Select-Object -First 1).Trim()
  $port = [int]$portText; $result.socket = $socketName; $result.localPort = $port
  Start-Sleep -Milliseconds 250
  $version = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 3
  $targets = @(Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/list" -TimeoutSec 3)
  $match = $targets | Where-Object { $_.type -eq 'page' -and $_.url -like "$($AppUrl.TrimEnd('/'))*" } | Select-Object -First 1
  if (-not $match) { $match = $targets | Where-Object type -eq 'page' | Select-Object -First 1 }
  $result.available = $true; $result.userAgent = $version.'User-Agent'
  if ($match) {
    $result.matchingTab = [ordered]@{ title = $match.title; url = $match.url; targetId = $match.id; type = $match.type; webSocketDebuggerUrl = $match.webSocketDebuggerUrl }
    if ($match.webSocketDebuggerUrl) {
      $pageState = Invoke-CdpExpression $match.webSocketDebuggerUrl "JSON.stringify({userAgent:navigator.userAgent,url:location.href,title:document.title,trace:(document.querySelector('[aria-label=\"Upload trace\"]')||{}).innerText||null})" | ConvertFrom-Json
      if ($pageState.userAgent) { $result.userAgent = $pageState.userAgent }
      if ($pageState.trace) { $pageState.trace | Set-Content -LiteralPath $tracePath -Encoding utf8 }
    }
  }
  @("Remote debugging connected.", "Socket: $socketName", "User agent: $($result.userAgent)", "Historical console events are not guaranteed unless DevTools was attached before they occurred.") |
    Set-Content -LiteralPath $consolePath -Encoding utf8
} catch {
  $result.error = $_.Exception.Message
  "Remote browser debugging unavailable: $($result.error)`nThe run continued; use screenshots, Logcat, and manual upload-trace capture." | Set-Content -LiteralPath $consolePath -Encoding utf8
} finally {
  if ($result.localPort) { try { Invoke-Adb $adb $Serial @('forward','--remove',"tcp:$($result.localPort)") | Out-Null } catch { } }
}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $RunDirectory 'browser-tab.json') -Encoding utf8
if (-not (Test-Path -LiteralPath $tracePath)) { 'Upload trace was not captured automatically. Copy it from ?debugUpload=1 and use the harness clipboard option.' | Set-Content -LiteralPath $tracePath -Encoding utf8 }
[pscustomobject]$result
