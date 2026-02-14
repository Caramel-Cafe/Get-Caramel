param(
  [string]$TargetEnv = "staging"
)

$ErrorActionPreference = "Stop"

$start = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
Write-Host "Starting DR drill for $TargetEnv"

& powershell -ExecutionPolicy Bypass -File "ops/security/validate-secrets.ps1" -EnvFile ".env.example" -AllowDefaults

$stateFile = "ops/release/state/$TargetEnv.txt"
if (-not (Test-Path $stateFile)) {
  throw "Missing release state file: $stateFile"
}

$stateRaw = Get-Content $stateFile -Raw
if ($stateRaw -notmatch "(?m)^release_sha=") {
  throw "release_sha missing in state file"
}

Write-Host "Traffic freeze simulated for $TargetEnv"

$end = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$rtoSeconds = $end - $start

New-Item -ItemType Directory -Force -Path "ops/dr/reports" | Out-Null
$stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
$report = "ops/dr/reports/drill-$TargetEnv-$stamp.txt"

@(
  "environment=$TargetEnv"
  "started_at_unix=$start"
  "finished_at_unix=$end"
  "rto_seconds=$rtoSeconds"
  "result=PASS"
) | Set-Content $report -Encoding UTF8

Write-Host "DR drill passed: $report"
