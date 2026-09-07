<#
.SYNOPSIS
  Run Branch Zero's walking demo autopilot and record it with GameLab's host capture seat.

.DESCRIPTION
  1. Launches Godot 4.5.2 maximized with --demo=walk (MockChain, funded account).
  2. Reads the game window's client rectangle and records exactly that region (ffmpeg gdigrab).
  3. Stops when this run's autopilot writes a unique completion marker (or -MaxSeconds), plus a short tail.
  Output: docs/progress/captures/demo-walk-<stamp>.mp4 (gitignored). Keep the game window unobstructed.

.PARAMETER MaxSeconds
  Hard cap on the recording (default 360). The autopilot circuit is ~3 min.

.PARAMETER Tail
  Seconds to keep recording after the done marker (default 4).

.PARAMETER Godot
  Optional path to a Godot 4.5.x exe (else $env:GODOT45 or the standard install location).

.EXAMPLE
  powershell -File .\scripts\record-demo-walk.ps1
#>
[CmdletBinding()]
param(
    [int]$MaxSeconds = 360,
    [int]$Tail = 4,
    [string]$Godot = ''
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$game = Join-Path $repo 'apps\game'
$outDir = Join-Path $repo 'docs\progress\captures'
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$outMp4 = Join-Path $outDir "demo-walk-$stamp.mp4"
$runId = [Guid]::NewGuid().ToString('N')
$marker = Join-Path $env:TEMP "branch-zero-demo-walk-$runId.done"
$env:BRANCH_ZERO_DEMO_MARKER = $marker

$capture = [System.IO.Path]::GetFullPath((Join-Path $repo '..\GameLab\runtimes\capture\scripts\run-host.ps1'))
if (-not (Test-Path $capture)) {
    throw "GameLab capture wrapper missing at $capture. Install ffmpeg / ENG-2026-0014 first."
}

function Resolve-Godot45 {
    param([string]$Hint)
    if ($Hint -and (Test-Path $Hint)) { return $Hint }
    if ($env:GODOT45 -and (Test-Path $env:GODOT45)) { return $env:GODOT45 }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Godot-4.5.2\Godot_v4.5.2-stable_win64.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Godot-4.5.2\Godot_v4.5.2-stable_win64_console.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Godot\Godot_v4.5.2-stable_win64.exe')
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    $onPath = Get-Command godot -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }
    throw 'Godot 4.5.2 not found. Install standard (non-mono) 4.5.2 or set $env:GODOT45.'
}

function Start-Quoted {
    param([string]$File, [string[]]$ArgParts, [switch]$Wait, [switch]$Hidden)
    $line = (
        $ArgParts | ForEach-Object {
            if ($_ -match '\s') { '"{0}"' -f ($_ -replace '"', '\"') } else { $_ }
        }
    ) -join ' '
    if ($Wait) {
        $p = Start-Process -FilePath $File -ArgumentList $line -Wait -PassThru
        return $p.ExitCode
    }
    if ($Hidden) {
        return Start-Process -FilePath $File -ArgumentList $line -PassThru -WindowStyle Hidden
    }
    return Start-Process -FilePath $File -ArgumentList $line -PassThru
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Win32Cap {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT p);
}
"@

function Get-ClientRegion {
    param([IntPtr]$Handle)
    $r = New-Object Win32Cap+RECT
    if (-not [Win32Cap]::GetClientRect($Handle, [ref]$r)) { return $null }
    $pt = New-Object Win32Cap+POINT
    $pt.X = 0; $pt.Y = 0
    [Win32Cap]::ClientToScreen($Handle, [ref]$pt) | Out-Null
    $w = $r.Right - $r.Left
    $h = $r.Bottom - $r.Top
    if ($w -lt 320 -or $h -lt 200) { return $null }
    return ('{0},{1},{2},{3}' -f $pt.X, $pt.Y, $w, $h)
}

$godotExe = Resolve-Godot45 -Hint $Godot
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
Remove-Item $marker -Force -ErrorAction SilentlyContinue

Write-Host "[record] godot=$godotExe"
Write-Host "[record] out=$outMp4 (cap ${MaxSeconds}s)"

Write-Host '[record] importing project...'
$null = Start-Quoted -File $godotExe -ArgParts @('--path', $game, '--import') -Wait

Write-Host '[record] launching demo walk (maximized)...'
$godotProc = Start-Quoted -File $godotExe -ArgParts @('--path', $game, '--maximized', '--', '--demo=walk')

# Wait for the window, then make sure it is maximized and in front.
$region = $null
$deadline = (Get-Date).AddSeconds(25)
while ((Get-Date) -lt $deadline) {
    $w = Get-Process -Id $godotProc.Id -ErrorAction SilentlyContinue
    if ($w -and $w.MainWindowHandle -ne [IntPtr]::Zero) {
        [Win32Cap]::ShowWindow($w.MainWindowHandle, 3) | Out-Null
        [Win32Cap]::SetForegroundWindow($w.MainWindowHandle) | Out-Null
        Start-Sleep -Milliseconds 800
        $region = Get-ClientRegion -Handle $w.MainWindowHandle
        if ($region) { break }
    }
    Start-Sleep -Milliseconds 400
}
if (-not $region) {
    Write-Host '[record] could not read the game window rect; recording the whole desktop'
}
else {
    Write-Host "[record] region=$region"
}
# The autopilot idles ~2 s after boot; start the grab right away so the arrival is on film.
Start-Sleep -Seconds 2

Write-Host '[record] capturing...'
$capArgs = @('-NoProfile', '-File', $capture, '-Record', '-Seconds', "$MaxSeconds", '-OutPath', $outMp4, '-Fragmented')
if ($region) { $capArgs += @('-Region', $region) }
# Hidden: a visible console would sit on top of the game for the opening seconds of the reel.
$capProc = Start-Quoted -File 'powershell' -ArgParts $capArgs -Hidden
Start-Sleep -Milliseconds 600
$w = Get-Process -Id $godotProc.Id -ErrorAction SilentlyContinue
if ($w -and $w.MainWindowHandle -ne [IntPtr]::Zero) {
    [Win32Cap]::SetForegroundWindow($w.MainWindowHandle) | Out-Null
}

# Stop on the done marker (plus tail) or when the cap runs out.
$t = 0
while ($t -lt $MaxSeconds) {
    if (Test-Path $marker) {
        Write-Host "[record] autopilot done at ~${t}s; tail ${Tail}s"
        Start-Sleep -Seconds $Tail
        break
    }
    if ($capProc.HasExited) { break }
    if ($godotProc.HasExited) {
        Write-Host '[record] game exited early'
        break
    }
    Start-Sleep -Seconds 1
    $t += 1
}

# Ask ffmpeg to stop (fragmented mp4 stays playable), then close the game.
Get-Process -Name ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
if (-not $capProc.HasExited) { $capProc.WaitForExit(10000) | Out-Null }
Write-Host '[record] stopping Godot...'
if ($godotProc -and -not $godotProc.HasExited) {
    Stop-Process -Id $godotProc.Id -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $outMp4)) { throw "capture missing: $outMp4" }
$len = (Get-Item $outMp4).Length
if ($len -lt 100KB) { throw "capture too small ($len bytes): $outMp4" }
$markerSeen = Test-Path $marker
Remove-Item $marker -Force -ErrorAction SilentlyContinue
Write-Host ("[record] DONE {0} ({1} bytes, marker={2})" -f $outMp4, $len, $markerSeen)
exit 0
