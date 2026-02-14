param(
  [string]$EnvFile = ".env",
  [switch]$AllowDefaults
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) {
  throw "Missing env file: $EnvFile"
}

$raw = Get-Content $EnvFile -Raw

$requiredKeys = @("AUTH_JWT_SECRET", "DATABASE_URL")
foreach ($key in $requiredKeys) {
  if ($raw -notmatch "(?m)^$key=") {
    throw "Missing required key: $key"
  }
}

$jwtLine = ($raw -split "`n" | Where-Object { $_ -match "^AUTH_JWT_SECRET=" } | Select-Object -First 1)
$jwtSecret = $jwtLine.Substring("AUTH_JWT_SECRET=".Length).Trim()

if (-not $AllowDefaults) {
  if ($jwtSecret -eq "replace_this_with_long_random_secret" -or $jwtSecret -eq "change-me-in-production") {
    throw "AUTH_JWT_SECRET is using an insecure default value"
  }

  if ($jwtSecret.Length -lt 24) {
    throw "AUTH_JWT_SECRET must be at least 24 characters"
  }

  if ($raw -match "(?m)=(password|changeme|secret|postgres)$") {
    throw "Potential default secret values detected in $EnvFile"
  }
}

Write-Host "Secret validation passed for $EnvFile"
