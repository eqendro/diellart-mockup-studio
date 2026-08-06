# Physical Samsung testing on Windows

This harness records repeatable evidence from one authorised physical Android device. ADB provides screenshots, device information and Logcat. scrcpy is optional and is only an operator view/control surface.

## Prerequisites

- Windows PowerShell 7 or Windows PowerShell 5.1.
- Android platform-tools (`adb.exe`). Put it on `PATH`, set `SAMSUNG_ADB_PATH`, or pass `-AdbPath`.
- Optional scrcpy. Put it on `PATH`, set `SAMSUNG_SCRCPY_PATH`, or pass `-ScrcpyPath`.
- A locally running DiellArt development server reachable from the phone.
- One USB-connected physical phone. Disconnect emulators and other Android devices.

On the Samsung phone, enable Developer options and USB debugging, connect USB, unlock the phone, and accept the computer's RSA authorisation prompt. The harness never enables settings, installs APKs, clears data, or deletes phone files.

Check the tools manually:

```powershell
adb version
adb devices -l
scrcpy --version
```

If the tools are not on `PATH`:

```powershell
$env:SAMSUNG_ADB_PATH = 'C:\path\to\platform-tools\adb.exe'
$env:SAMSUNG_SCRCPY_PATH = 'C:\path\to\scrcpy.exe'
```

## Preflight

```powershell
powershell -ExecutionPolicy Bypass -File scripts\physical-device\Test-AdbPreflight.ps1
```

Preflight requires exactly one device in the `device` state. It reports clear actions for no device, `unauthorized`, `offline`, and multiple-device states. It records manufacturer, model, Android/SDK versions, screen properties, orientation, battery, Chrome, and Samsung Internet versions.

## Start the app

Run the development server on an address reachable by the phone, for example:

```powershell
npm run dev -- --hostname 0.0.0.0
```

The main harness opens the supplied URL through Android. Confirm Windows Firewall permits the local port.

## Run a named test

Preset example:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\physical-device\Invoke-SamsungTest.ps1 `
  -Name google-photos-vodafone `
  -AppUrl 'http://192.168.100.31:3000/?debugUpload=1' `
  -StartScrcpy
```

Custom example:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\physical-device\Invoke-SamsungTest.ps1 `
  -Name custom-vodafone `
  -PickerSource 'Android Files' `
  -Fixture 'Vodafone' `
  -AppUrl 'http://192.168.100.31:3000/?debugUpload=1' `
  -Notes 'Downloaded local copy'
```

Presets are stored in `scripts/physical-device/test-cases.json`.

## Operator prompts

At every prompt the harness prints the complete action list:

- `[Enter] Capture standard stage`
- `[A] Additional screenshot`
- `[T] Paste upload trace`
- `[N] Add note`
- `[S] Set final status`
- `[F] Finish run`
- `[Q] Abort safely`

Choose `T` before pasting an upload trace. The harness then enters a dedicated multiline mode: paste arbitrary lines, and enter `ENDTRACE` on a line by itself when finished. Trace lines are not interpreted as actions. Their order, spaces, colons, Unicode checkmarks, and error symbols are preserved in `upload-trace.txt`.

If trace-like text is accidentally pasted at the action prompt, the harness displays `This looks like upload-trace content. Enter T first, then paste the trace.` once instead of producing an unknown-action message for every pasted line. Choose `T` and paste the trace again.

To import an existing trace without interactive pasting:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\physical-device\Invoke-SamsungTest.ps1 `
  -Name google-photos-vodafone `
  -AppUrl 'http://192.168.100.31:3000/?debugUpload=1' `
  -UploadTraceFile 'C:\path\to\upload-trace.txt'
```

The file is copied byte-for-byte into the run evidence folder. The standard input workflow remains available during an interactive run.

Suggested progression: initial page, native picker open, picker returned, processing, crop/review, final result. Ctrl+C is handled through the runner's cleanup path when PowerShell permits `finally` execution; trace lines already received are written before cleanup. If the host terminates abruptly, the partial folder and Logcat PID state remain available for manual cleanup.

Run the focused operator-input checks with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\physical-device\tests\Test-OperatorInput.ps1
```

## Evidence

Runs are created under:

```text
test-results\physical-samsung\YYYY-MM-DD_HHMMSS_test-name\
```

The directory contains numbered PNGs, device JSON/text, raw and filtered Logcat, browser target information, browser-console status, upload trace, machine-readable metadata, and Markdown summary. Generated folders are ignored by Git; `.gitkeep` preserves the parent directory.

Capture an extra screenshot directly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\physical-device\Capture-AndroidScreenshot.ps1 `
  -RunDirectory 'test-results\physical-samsung\RUN_ID' `
  -Stage 'candidate-review'
```

## Browser debugging and upload traces

The harness checks `/proc/net/unix` for a genuinely exposed Chrome/WebView DevTools socket, creates a temporary ADB forward, queries `/json/version` and `/json/list`, and attempts a CDP DOM extraction of the existing `Upload trace` panel. It removes the forward afterward.

Chrome remote debugging is optional. Samsung Internet does not automatically share Chrome's endpoint. When no usable endpoint is exposed, the run continues and records the limitation. Copy the visible `?debugUpload=1` trace, return to the terminal, choose `T`, paste the trace, and finish with `ENDTRACE` on its own line.

Logcat is not represented as JavaScript console output. `browser-console.txt` states whether remote debugging was available and warns that historical console messages are not guaranteed unless DevTools was attached before they occurred.

## Logcat cleanup

Normal completion and handled aborts stop Logcat automatically. If PowerShell was forcibly terminated:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\physical-device\Stop-AndroidLogcat.ps1 `
  -RunDirectory 'test-results\physical-samsung\RUN_ID'
```

The harness does not clear the phone's Logcat buffer. It starts at the current tail and creates both a raw file and a second broadly filtered file.

## Compare runs

Compare `run-metadata.json`, `run-summary.md`, `upload-trace.txt`, and similarly numbered screenshots. Useful comparisons keep the fixture fixed and change only the picker source, such as `google-photos-vodafone` versus `android-files-vodafone`.

## Disconnect safely

Stop any scrcpy window, disconnect USB, then disable USB debugging on the phone if it is no longer needed. Remove the computer from the phone's authorised debugging computers if appropriate.

## Known limitations

- Native picker/camera interaction remains human-driven.
- ADB screenshots capture the phone display but some secure surfaces may intentionally appear blank.
- Browser DevTools sockets depend on browser build/settings and may be absent.
- Samsung Internet cannot be assumed to expose Chrome's DevTools endpoint.
- Historical browser console events cannot be recovered if no debugger was attached when they occurred.
- Final route/status fields depend on operator observation when CDP is unavailable.
