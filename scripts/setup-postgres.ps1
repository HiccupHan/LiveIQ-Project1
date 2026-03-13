param(
  [string]$ContainerName = "liveiq-postgres",
  [string]$PostgresUser = "postgres",
  [string]$PostgresPassword = "postgres",
  [string]$PostgresDb = "liveiq",
  [int]$HostPort = 5432,
  [string]$Image = "postgres:16"
)

function Test-DockerDaemon {
  $serverVersion = cmd /c "docker info --format {{.ServerVersion}} 2>nul"
  if ($LASTEXITCODE -ne 0) {
    return $false
  }
  if ([string]::IsNullOrWhiteSpace($serverVersion)) {
    return $false
  }
  return $true
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker CLI not found. Install Docker Desktop and try again."
}

if (-not (Test-DockerDaemon)) {
  throw "Docker daemon is not reachable. Start Docker Desktop and try again."
}

$existing = docker ps -a --filter "name=^/${ContainerName}$" --format "{{.Names}}"

if ($existing -eq $ContainerName) {
  $running = docker ps --filter "name=^/${ContainerName}$" --format "{{.Names}}"
  if ($running -ne $ContainerName) {
    Write-Host "Starting existing container '$ContainerName'..."
    docker start $ContainerName | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to start container '$ContainerName'. Check Docker Desktop status and permissions."
    }
  } else {
    Write-Host "Container '$ContainerName' is already running."
  }
} else {
  Write-Host "Creating container '$ContainerName' from image '$Image'..."
  docker run --name $ContainerName `
    -e "POSTGRES_USER=$PostgresUser" `
    -e "POSTGRES_PASSWORD=$PostgresPassword" `
    -e "POSTGRES_DB=$PostgresDb" `
    -p "${HostPort}:5432" `
    -d $Image | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create container '$ContainerName'. Check Docker Desktop status and permissions."
  }
}

Write-Host "Waiting for Postgres to become ready..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  docker exec $ContainerName pg_isready -U $PostgresUser -d $PostgresDb | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  throw "Postgres did not become ready within 60 seconds."
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$envPath = Join-Path $projectRoot ".env"

$envContent = @"
DB_TYPE=postgres
DB_HOST=127.0.0.1
DB_PORT=$HostPort
DB_USER=$PostgresUser
DB_PASS=$PostgresPassword
DB_NAME=$PostgresDb
"@

Set-Content -Path $envPath -Value $envContent -Encoding UTF8

Write-Host "Postgres is ready."
Write-Host ".env updated at: $envPath"
Write-Host "Next: npm run start:dev"
