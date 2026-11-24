# Creates the "ArdHavaleh" scheduled task: starts at boot, runs as SYSTEM
# (no login needed), no time limit, restarts if it fails.
#
# Why PowerShell and not schtasks.exe: schtasks gives every task a hidden
# 72-hour time limit, so the system would be killed every 3 days.
param([Parameter(Mandatory = $true)][string]$Root)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path $Root).Path
$script = Join-Path $root 'scripts\run-server.cmd'
if (-not (Test-Path $script)) { throw "Not found: $script" }

$action = New-ScheduledTaskAction -Execute $script -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName 'ArdHavaleh' -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Force | Out-Null
Write-Host 'Task "ArdHavaleh" created.'
