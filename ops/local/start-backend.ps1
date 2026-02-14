param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envFile = Join-Path $projectRoot ".env"

function Load-DotEnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    Write-Host "Env file not found at $Path; using existing process environment."
    return
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    if ($line.StartsWith("#")) { return }

    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) { return }

    $key = $parts[0].Trim()
    if (-not $key) { return }

    $value = $parts[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
  }

  Write-Host "Loaded environment from $Path"
}

Load-DotEnvFile -Path $envFile

$services = @(
  @{ Name = "auth-service"; Cmd = "pnpm --filter @get-caramel/auth-service dev" },
  @{ Name = "catalog-service"; Cmd = "pnpm --filter @get-caramel/catalog-service dev" },
  @{ Name = "order-service"; Cmd = "pnpm --filter @get-caramel/order-service dev" },
  @{ Name = "payment-service"; Cmd = "pnpm --filter @get-caramel/payment-service dev" },
  @{ Name = "delivery-service"; Cmd = "pnpm --filter @get-caramel/delivery-service dev" },
  @{ Name = "api-gateway"; Cmd = "pnpm --filter @get-caramel/api-gateway dev" }
)

foreach ($svc in $services) {
  $title = "GetCaramel-$($svc.Name)"
  $inner = "& { " +
    "`$host.UI.RawUI.WindowTitle='$title'; " +
    "Set-Location '$projectRoot'; " +
    "$($svc.Cmd) " +
  "}"

  if ($DryRun) {
    Write-Host "[DRYRUN] $title -> $($svc.Cmd)"
    continue
  }

  Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoLogo",
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $inner
  ) | Out-Null
}

if (-not $DryRun) {
  Write-Host "Started backend services in separate windows."
  Write-Host "Next: run smoke -> powershell -ExecutionPolicy Bypass -File ops/local/smoke-gateway.ps1"
}
