#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="liveiq-postgres"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
POSTGRES_DB="liveiq"
HOST_PORT="5432"
IMAGE="postgres:16"

usage() {
  cat <<'EOF'
Usage: ./scripts/setup-postgres.sh [options]

Options:
  --container-name <name>   Docker container name (default: liveiq-postgres)
  --user <name>             Postgres user (default: postgres)
  --password <value>        Postgres password (default: postgres)
  --db <name>               Postgres database name (default: liveiq)
  --port <port>             Host port mapped to container 5432 (default: 5432)
  --image <image>           Docker image (default: postgres:16)
  -h, --help                Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --container-name)
      CONTAINER_NAME="$2"
      shift 2
      ;;
    --user)
      POSTGRES_USER="$2"
      shift 2
      ;;
    --password)
      POSTGRES_PASSWORD="$2"
      shift 2
      ;;
    --db)
      POSTGRES_DB="$2"
      shift 2
      ;;
    --port)
      HOST_PORT="$2"
      shift 2
      ;;
    --image)
      IMAGE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI not found. Install Docker Desktop and try again." >&2
  exit 1
fi

if ! docker info --format '{{.ServerVersion}}' >/dev/null 2>&1; then
  echo "Docker daemon is not reachable. Start Docker Desktop and try again." >&2
  exit 1
fi

existing="$(docker ps -a --filter "name=^/${CONTAINER_NAME}$" --format '{{.Names}}')"

if [[ "$existing" == "$CONTAINER_NAME" ]]; then
  running="$(docker ps --filter "name=^/${CONTAINER_NAME}$" --format '{{.Names}}')"
  if [[ "$running" != "$CONTAINER_NAME" ]]; then
    echo "Starting existing container '$CONTAINER_NAME'..."
    docker start "$CONTAINER_NAME" >/dev/null
  else
    echo "Container '$CONTAINER_NAME' is already running."
  fi
else
  echo "Creating container '$CONTAINER_NAME' from image '$IMAGE'..."
  docker run --name "$CONTAINER_NAME" \
    -e "POSTGRES_USER=$POSTGRES_USER" \
    -e "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
    -e "POSTGRES_DB=$POSTGRES_DB" \
    -p "${HOST_PORT}:5432" \
    -d "$IMAGE" >/dev/null
fi

echo "Waiting for Postgres to become ready..."
ready="false"
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    ready="true"
    break
  fi
  sleep 1
done

if [[ "$ready" != "true" ]]; then
  echo "Postgres did not become ready within 60 seconds." >&2
  exit 1
fi

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_path="$project_root/.env"

cat > "$env_path" <<EOF
DB_TYPE=postgres
DB_HOST=127.0.0.1
DB_PORT=$HOST_PORT
DB_USER=$POSTGRES_USER
DB_PASS=$POSTGRES_PASSWORD
DB_NAME=$POSTGRES_DB
EOF

echo "Postgres is ready."
echo ".env updated at: $env_path"
echo "Next: npm run start:dev"
