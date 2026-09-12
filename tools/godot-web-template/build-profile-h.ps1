# Build the pinned Branch Zero web export template — "Profile H" (GameLab ENG-2026-0025 Profile E + basis_universal).
#
#   powershell -File tools\godot-web-template\build-profile-h.ps1 -Root D:\build\godot-web-template
#
# -Root holds two clones and ~5 GB of build scratch; nothing under it belongs in this repo.
#   git clone --depth 1 --branch 4.5.2-stable https://github.com/godotengine/godot.git <Root>\godot-src
#   git clone --depth 1 https://github.com/emscripten-core/emsdk.git <Root>\emsdk
#   <Root>\emsdk\emsdk.bat install 4.0.11 ; <Root>\emsdk\emsdk.bat activate 4.0.11
#   python -m pip install --user scons
#
# Output: <Root>\godot-src\bin\godot.web.template_release.wasm32.nothreads.zip, copied next to this script.
# Verify with: sha256sum -c tools/godot-web-template/SHA256SUMS
#
# Pass -WithGltf to build "Profile G" instead (adds module_gltf, +580 KB) — see README.md.

param(
  [Parameter(Mandatory = $true)][string]$Root,
  [switch]$WithGltf,
  [int]$Jobs = 8
)

$sdk = Join-Path $Root 'emsdk'
$src = Join-Path $Root 'godot-src'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
# Same commit as apps/game/.godot-version → Godot_v4.5.2-stable (tag 4.5.2-stable).
$ExpectedCommit = '6ce3de25aa58466e14ef354703ba8d9791a417da'

if (-not (Test-Path (Join-Path $src '.git'))) {
  throw "godot-src missing or not a git clone: $src — clone tag 4.5.2-stable first (see script header)."
}
$head = (git -C $src rev-parse HEAD 2>$null).Trim()
if ($head -ne $ExpectedCommit) {
  throw @"
godot-src HEAD is not the pinned 4.5.2-stable commit.
  want $ExpectedCommit
  got  $head
  path $src
Rebuild with: git clone --depth 1 --branch 4.5.2-stable https://github.com/godotengine/godot.git <Root>\godot-src
"@
}
Write-Output "godot-src HEAD $head (4.5.2-stable pin OK)"

# emsdk_env.ps1 prints its banner to stderr, which PowerShell 5.1 turns into a terminating
# NativeCommandError. Set the environment directly instead of sourcing it.
$env:EMSDK_QUIET  = '1'
$env:EMSDK        = $sdk
$env:EM_CONFIG    = "$sdk\.emscripten"
$env:EMSDK_PYTHON = (Get-ChildItem "$sdk\python\*\python.exe" | Select-Object -First 1).FullName
$env:EMSDK_NODE   = (Get-ChildItem "$sdk\node\*\node.exe" | Select-Object -First 1).FullName
$env:PATH         = "$sdk;$sdk\upstream\emscripten;$(Split-Path $env:EMSDK_NODE);$env:PATH"

Set-Location $src

$modulesOn = @(
  'gdscript', 'freetype', 'text_server_fb', 'text_server_adv',
  'godot_physics_2d', 'godot_physics_3d',
  'navigation_2d', 'navigation_3d',
  'webp', 'svg', 'ogg', 'vorbis', 'mbedtls', 'regex', 'bcdec',
  'noise',            # FastNoiseLite terrazzo floor — scripts/props.gd
  'basis_universal'   # gum_bot_bank.glb imports embedded images as Basis Universal
)
if ($WithGltf) { $modulesOn += 'gltf' }

# optimize=size_extra is load-bearing: plain optimize=size lands ~31 MiB and fails the Pages cap.
$flags = @(
  'platform=web', 'target=template_release', 'threads=no',
  'optimize=size_extra', 'deprecated=no', 'minizip=no',
  'modules_enabled_by_default=no'
)
foreach ($m in $modulesOn) { $flags += "module_${m}_enabled=yes" }

Write-Output "=== scons flags (Profile $(if ($WithGltf) { 'G' } else { 'H' })) ==="
$flags | ForEach-Object { Write-Output "  $_" }

& python -m SCons @flags -j$Jobs
if ($LASTEXITCODE -ne 0) { throw "scons failed with $LASTEXITCODE" }

$zip = Join-Path $src 'bin\godot.web.template_release.wasm32.nothreads.zip'
$dest = Join-Path $here "godot-4.5.2-stable-web-nothreads-lean-$(if ($WithGltf) { 'g' } else { 'h' }).zip"
Copy-Item $zip $dest -Force
Get-FileHash $dest -Algorithm SHA256 | Format-List Hash, Path
