# LiveIQ Backend (NestJS)

This project is a NestJS backend for managing users and events.

## Prerequisites

- Node.js `>=20`
- npm `>=10`
- Optional: Docker Desktop (only if you want to run with Postgres)

## Install

```bash
npm install
```

## Run the API

### Option A: Quick local run (in-memory DB)

Use `sqljs` for fast local development with no external database.

PowerShell:

```powershell
$env:DB_TYPE="sqljs"
$env:DB_SQLJS_LOCATION=":memory:"
$env:DB_SYNC="true"
npm run start:dev
```

The API will be available at `http://localhost:3000`.

### Option B: Run with Postgres (Docker)

Use the setup script to create/start a Postgres container and write `.env`.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-postgres.ps1
npm run start:dev
```

If you prefer manual config, create `.env` in project root:

```env
DB_TYPE=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=liveiq
DB_SYNC=true
```

## Run tests

### Unit tests

```bash
npm run test
```

### Coverage report

```bash
npm run test:cov
```

### End-to-end tests

```bash
npm run test:e2e
```

## Build

```bash
npm run build
```
