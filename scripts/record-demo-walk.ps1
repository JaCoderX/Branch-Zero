<#
.SYNOPSIS
  Run Branch Zero's walking demo autopilot and record it with GameLab's host capture seat.

.DESCRIPTION
  1. Launches Godot 4.5.2 maximized with --demo=walk (MockChain, funded account).
  2. Reads the game window's client rectangle and records exactly that region (ffmpeg gdigrab).
  3. Writes a go marker once ffmpeg is rolling; the autopilot (demo_walk.gd) waits for it, so the walk to Ash is on film.
  4. Stops when this run's autopilot writes a unique completion marker (or -MaxSeconds), plus a short tail.
  5. Direct ddagrab grabs end on 'q' (clean mp4); wrapper grabs are remuxed + trimmed. Godot's --log-file sits beside it.
  Output: docs/progress/captures/demo-walk-<stamp>.mp4 + .log (gitignored). Keep the game window unobstructed.

.PARAMETER MaxSeconds
  Hard cap on the recording (default 360). The autopilot circuit is ~3 min.

.PARAMETER Tail
  Seconds to keep recording after the done marker (default 4).

.PARAMETER Godot
  Optional path to a Godot 4.5.x exe (else $env:GODOT45 or the standard install location).

.PARAMETER Encoder
  auto (default): drive ffmpeg directly — ddagrab (Desktop Duplication, D3D11) + libx264 ultrafast — and end it with a
  clean 'q' so the mp4 needs no remux. gdigrab (the wrapper's device) BitBlts ~10-13 fps at 1920x1008 on this laptop;
  ddagrab holds ~25-30. NVENC needs driver >= 610 (not here); QSV works but hwdownload/upload costs ~1/3 of the frames.
  x264: always use GameLab's run-host.ps1 wrapper (gdigrab + libx264 veryfast, fragmented mp4, remuxed + trimmed).

.EXAMPLE
  powershell -File .\scripts\record-demo-walk.ps1
#>
[CmdletBinding()]
param(
    [int]$MaxSeconds = 360,
    [int]$Tail = 4,
    [string]$Godot = '',
    [ValidateSet('auto', 'x264')][string]$Encoder = 'auto'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$game = Join-Path $repo 'apps\game'
$outDir = Join-Path $repo 'docs\progress\captures'
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$outMp4 = Join-Path $outDir "demo-walk-$stamp.mp4"
$fragMp4 = Join-Path $outDir "demo-walk-$stamp.frag.mp4"
$outLog = Join-Path $outDir "demo-walk-$stamp.log"
$runId = [Guid]::NewGuid().ToString('N')
$marker = Join-Path $env:TEMP "branch-zero-demo-walk-$runId.done"
$goMarker = Join-Path $env:TEMP "branch-zero-demo-walk-$runId.go"
$env:BRANCH_ZERO_DEMO_MARKER = $marker
$env:BRANCH_ZERO_DEMO_GO = $goMarker

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

function Resolve-Ffmpeg {
    if ($env:FFMPEG -and (Test-Path $env:FFMPEG)) { return $env:FFMPEG }
    $onPath = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }
    $wingetRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    if (Test-Path $wingetRoot) {
        $hit = Get-ChildItem -Path $wingetRoot -Filter 'ffmpeg.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hit) { return $hit.FullName }
    }
    return $null
}

## Functional probe: can this ffmpeg open the primary display through Desktop Duplication?
function Test-Ddagrab {
    param([string]$FfmpegPath)
    try {
        $p = Start-Process -FilePath $FfmpegPath -ArgumentList '-v error -f lavfi -i ddagrab=output_idx=0:framerate=30 -t 0.3 -f null -' -Wait -PassThru -NoNewWindow -RedirectStandardError ([System.IO.Path]::GetTempFileName())
        return ($p.ExitCode -eq 0)
    }
    catch { return $false }
}

## Direct ffmpeg with stdin kept open so 'q' can end the grab cleanly (a proper moov, no torn tail).
function Start-FfmpegDirect {
    param([string]$FfmpegPath, [string[]]$FfmpegArgs)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FfmpegPath
    $psi.Arguments = (
        $FfmpegArgs | ForEach-Object {
            if ($_ -match '\s') { '"{0}"' -f ($_ -replace '"', '\"') } else { $_ }
        }
    ) -join ' '
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardError = $true      # -loglevel error keeps this small; read after exit
    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi
    $null = $p.Start()
    return $p
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
Remove-Item $marker, $goMarker -Force -ErrorAction SilentlyContinue

Write-Host "[record] godot=$godotExe"
Write-Host "[record] out=$outMp4 (cap ${MaxSeconds}s)"

Write-Host '[record] importing project...'
$null = Start-Quoted -File $godotExe -ArgParts @('--path', $game, '--import') -Wait

Write-Host '[record] launching demo walk (maximized)...'
$godotProc = Start-Quoted -File $godotExe -ArgParts @('--path', $game, '--maximized', '--log-file', $outLog, '--', '--demo=walk')

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
# The autopilot holds at the spawn until BRANCH_ZERO_DEMO_GO exists (up to 40 s), so start the grab now and
# write the go marker once ffmpeg is actually rolling — the first steps toward Ash are then on film.
$ffmpeg = Resolve-Ffmpeg
$direct = ($Encoder -eq 'auto') -and $ffmpeg -and (Test-Ddagrab -FfmpegPath $ffmpeg)

function Start-WrapperCapture {
    Write-Host '[record] capturing (GameLab run-host.ps1, gdigrab + libx264)...'
    $capArgs = @('-NoProfile', '-File', $capture, '-Record', '-Seconds', "$MaxSeconds", '-OutPath', $fragMp4, '-Fragmented')
    if ($region) { $capArgs += @('-Region', $region) }
    # Hidden: a visible console would sit on top of the game for the opening seconds of the reel.
    return Start-Quoted -File 'powershell' -ArgParts $capArgs -Hidden
}

function Wait-Rolling {
    param($Proc, [string]$File)
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        if ((Test-Path $File) -and (Get-Process -Name ffmpeg -ErrorAction SilentlyContinue)) { return $true }
        if ($Proc.HasExited) { return $false }
        Start-Sleep -Milliseconds 250
    }
    return $false
}

$grabFile = $fragMp4
if ($direct) {
    Write-Host '[record] capturing (direct ffmpeg: ddagrab + libx264 ultrafast, 30 fps)...'
    $grabFile = $outMp4
    $grab = 'ddagrab=output_idx=0:framerate=30:draw_mouse=0'
    if ($region) {
        $parts = $region.Split(',') | ForEach-Object { [int]$_ }
        $rw = $parts[2] - ($parts[2] % 2); $rh = $parts[3] - ($parts[3] % 2)
        $grab += (':offset_x={0}:offset_y={1}:video_size={2}x{3}' -f $parts[0], $parts[1], $rw, $rh)
    }
    $ffArgs = @('-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', "$grab,hwdownload,format=bgra", '-t', "$MaxSeconds",
        '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '23',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', $outMp4)
    $capProc = Start-FfmpegDirect -FfmpegPath $ffmpeg -FfmpegArgs $ffArgs
    $rolling = Wait-Rolling -Proc $capProc -File $grabFile
    if (-not $rolling) {
        $errText = ''
        try { $errText = $capProc.StandardError.ReadToEnd() } catch {}
        Write-Host "[record] direct ffmpeg did not start; falling back to the wrapper. ffmpeg said: $errText"
        Remove-Item $outMp4 -Force -ErrorAction SilentlyContinue
        $direct = $false
        $grabFile = $fragMp4
        $capProc = Start-WrapperCapture
        $rolling = Wait-Rolling -Proc $capProc -File $grabFile
    }
}
else {
    $capProc = Start-WrapperCapture
    $rolling = Wait-Rolling -Proc $capProc -File $grabFile
}
$w = Get-Process -Id $godotProc.Id -ErrorAction SilentlyContinue
if ($w -and $w.MainWindowHandle -ne [IntPtr]::Zero) {
    [Win32Cap]::SetForegroundWindow($w.MainWindowHandle) | Out-Null
}
Start-Sleep -Milliseconds 700
Set-Content -Path $goMarker -Value 'go' -Encoding ascii
Write-Host ("[record] go marker written (ffmpeg rolling={0})" -f $rolling)

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

# Stop the grab: 'q' on the direct path finalizes the mp4; the wrapper path is killed (fragmented mp4 stays playable).
if ($direct) {
    if (-not $capProc.HasExited) {
        try { $capProc.StandardInput.Write('q'); $capProc.StandardInput.Flush() } catch {}
        if (-not $capProc.WaitForExit(15000)) { $capProc.Kill() }
    }
    try {
        $errText = $capProc.StandardError.ReadToEnd()
        if ($errText.Trim()) { Write-Host "[record] ffmpeg stderr: $($errText.Trim())" }
    } catch {}
}
else {
    Get-Process -Name ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if (-not $capProc.HasExited) { $capProc.WaitForExit(10000) | Out-Null }
}
Write-Host '[record] stopping Godot...'
if ($godotProc -and -not $godotProc.HasExited) {
    Stop-Process -Id $godotProc.Id -Force -ErrorAction SilentlyContinue
}

$ffprobe = $null
if ($ffmpeg) {
    $ffprobe = Join-Path (Split-Path -Parent $ffmpeg) 'ffprobe.exe'
    if (-not (Test-Path $ffprobe)) { $ffprobe = $null }
}
if (-not $direct) {
    if (-not (Test-Path $fragMp4)) { throw "capture missing: $fragMp4" }
    $fragLen = (Get-Item $fragMp4).Length
    if ($fragLen -lt 100KB) { throw "capture too small ($fragLen bytes): $fragMp4" }
    # Killing ffmpeg leaves a torn last fragment (decoders log "Invalid NAL unit size" at the tail). A stream copy
    # into a plain faststart mp4, cut 1.2 s before the end, drops that tail and makes the reel seekable anywhere.
    if ($ffmpeg) {
        Write-Host '[record] finalizing (remux, stream copy, trim torn tail)...'
        $trimArgs = @()
        if ($ffprobe) {
            $fd = & $ffprobe -v error -show_entries format=duration -of csv=p=0 $fragMp4 2>$null
            $fdur = 0.0
            if ([double]::TryParse(([string]$fd).Trim(), [ref]$fdur) -and $fdur -gt 5.0) {
                $trimArgs = @('-t', ('{0:0.0}' -f ($fdur - 1.2)))
            }
        }
        $rc = Start-Quoted -File $ffmpeg -ArgParts (@('-y', '-v', 'error', '-i', $fragMp4) + $trimArgs + @('-c', 'copy', '-movflags', '+faststart', $outMp4)) -Wait
        if ($rc -eq 0 -and (Test-Path $outMp4) -and ((Get-Item $outMp4).Length -gt 100KB)) {
            Remove-Item $fragMp4 -Force -ErrorAction SilentlyContinue
        }
        else {
            Write-Host "[record] remux failed (exit $rc); keeping the fragmented grab"
            Move-Item -Path $fragMp4 -Destination $outMp4 -Force
        }
    }
    else {
        Move-Item -Path $fragMp4 -Destination $outMp4 -Force
    }
}
if (-not (Test-Path $outMp4)) { throw "capture missing: $outMp4" }
if ($ffprobe) {
    $dur = & $ffprobe -v error -show_entries format=duration:stream=nb_frames -of csv=p=0 $outMp4 2>$null
    Write-Host ("[record] probe (frames, duration s) = {0}" -f (([string]$dur) -replace '\s+', ' ').Trim())
}
$len = (Get-Item $outMp4).Length
$markerSeen = Test-Path $marker
Remove-Item $marker, $goMarker -Force -ErrorAction SilentlyContinue
Write-Host ("[record] DONE {0} ({1} bytes, marker={2}, log={3})" -f $outMp4, $len, $markerSeen, $outLog)
exit 0
