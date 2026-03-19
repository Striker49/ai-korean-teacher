$projectPath = "D:\Users\Administrator\Desktop\Projects\ai_korean_teacher"
$serverPath  = Join-Path $projectPath "server.py"
$assistantPath = Join-Path $projectPath "assistant.js"

Start-Process wt -ArgumentList @(
    "new-tab",
    "--title", "XTTS",
    "powershell",
    "-NoExit",
    "-Command",
    "& {
        chcp 65001
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
        [Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
        py -3 `"$serverPath`"
    }"
)

Start-Sleep -Seconds 5

Start-Process wt -ArgumentList @(
    "new-tab",
    "--title", "Assistant",
    "powershell",
    "-NoExit",
    "-Command",
    "& {
        chcp 65001
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
        [Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
        node `"$assistantPath`"
    }"
)