$ErrorActionPreference = 'SilentlyContinue'
try {
    $stdin = [Console]::In.ReadToEnd()
    if ($stdin) {
        $data = $stdin | ConvertFrom-Json
        $fp = $data.tool_input.file_path
        # dashboard.html と css/・js/ 配下の編集を検知する
        if ($fp -and (($fp -like "*dashboard.html") -or ($fp -match '[\\/]private[\\/](css|js)[\\/]'))) {
            "1" | Out-File -FilePath "c:\work\private\.claude\.dirty" -Encoding utf8 -Force
        }
    }
} catch {}
exit 0
