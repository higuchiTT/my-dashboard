$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$dirtyPath     = "c:\work\private\.claude\.dirty"
$checklistPath = "c:\work\private\.claude\checklist.md"

$stopHookActive = $false
try {
    $stdin = [Console]::In.ReadToEnd()
    if ($stdin) {
        $data = $stdin | ConvertFrom-Json
        if ($data.stop_hook_active -eq $true) { $stopHookActive = $true }
    }
} catch {}

if ($stopHookActive) { exit 0 }

if (Test-Path $dirtyPath) {
    Remove-Item $dirtyPath -Force -ErrorAction SilentlyContinue

    $checklist = ""
    if (Test-Path $checklistPath) {
        try { $checklist = [System.IO.File]::ReadAllText($checklistPath, [System.Text.Encoding]::UTF8) } catch { $checklist = "(checklist.md load failed)" }
    } else {
        $checklist = "(checklist.md not found)"
    }

    $payload = @{
        decision = "block"
        reason   = $checklist
    } | ConvertTo-Json -Compress

    Write-Output $payload
    exit 0
}

exit 0
