# AI-Powered Quiz Platform — Deployment & Operations Guide

## 1. System Overview & Runtime Topology

The platform is designed as a modular monolith accompanied by specialized background processing and an isolated AI inference service:

```
                      +-----------------------------+
                      |   React + Vite Frontend     |
                      |   (Client SPA / Port 5173)  |
                      +--------------+--------------+
                                     |
                                     | REST / JSON (JWT)
                                     v
                      +-----------------------------+
                      |     NestJS Modular API      |
                      |       (Port 3000)           |
                      +-------+-------------+-------+
                              |             |
        +---------------------+             +---------------------+
        | TypeORM                           | BullMQ              |
        v                                   v                     v HTTP (Internal)
+---------------+                   +---------------+     +---------------+
|  PostgreSQL   |                   |     Redis     |     | FastAPI Multi-|
|  (Port 5432)  |                   |  (Port 6379)  |     | Agent Service |
| Persistent DB |                   | Background Q  |     |  (Port 8000)  |
+---------------+                   +---------------+     +---------------+
```

---

## 2. Prerequisites

### Local Development / Host Requirements
- **Node.js**: `v20.x` or `v22.x` (ESM module support)
- **npm**: `v10.x` or higher
- **Python**: `v3.11+` (tested through `v3.13`)
- **Docker & Docker Compose**: Docker Engine `v24+` with Compose v2
- **PostgreSQL**: `16.x`
- **Redis**: `7.x` with Append-Only File (AOF) persistence enabled

---

## 3. Environment Configuration

The application validates required environment configuration at startup. Missing or malformed configuration aborts startup with clear, actionable diagnostics.

### 3.1 Backend Configuration (`apps/api/.env`)
Copy `apps/api/.env.example` to `apps/api/.env`:

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | No | `development` | Environment mode (`development`, `staging`, `production`) |
| `PORT` | No | `3000` | HTTP listening port (1-65535) |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Comma-separated allowed frontend origins |
| `DB_HOST` | **Yes** | `localhost` | PostgreSQL host |
| `DB_PORT` | **Yes** | `5432` | PostgreSQL port |
| `DB_USERNAME` | **Yes** | `quiz_user` | PostgreSQL user |
| `DB_PASSWORD` | **Yes** | `quiz_password` | PostgreSQL password |
| `DB_DATABASE` | **Yes** | `quiz_platform` | PostgreSQL database name |
| `REDIS_HOST` | **Yes** | `localhost` | Redis host |
| `REDIS_PORT` | **Yes** | `6379` | Redis port |
| `REDIS_PASSWORD` | No | *(empty)* | Optional Redis authentication |
| `JWT_ACCESS_SECRET` | **Yes** | *(min 16 chars)* | Secret key for signing access JWT tokens |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token lifespan |
| `AUTH_RATE_LIMIT_MAX` | No | `10` | Max auth attempts per IP per window |
| `AUTH_RATE_LIMIT_TTL_SECONDS`| No | `60` | Sliding window in seconds for auth throttling |
| `AI_SERVICE_URL` | No | `http://127.0.0.1:8000` | Upstream FastAPI service URL |
| `AI_SERVICE_TIMEOUT_MS` | No | `180000` | Multi-agent generation timeout (3 minutes) |
| `AI_RATE_LIMIT_MAX` | No | `5` | Max AI generation calls per IP/user per window |
| `AI_RATE_LIMIT_TTL_SECONDS` | No | `60` | Window in seconds for AI throttling |

### 3.2 Frontend Configuration (`apps/web/.env`)
Copy `apps/web/.env.example` to `apps/web/.env`:

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | No | `http://localhost:3000` | Backend API base URL (`/api` behind reverse proxy) |

### 3.3 AI Service Configuration (`apps/ai/.env`)
Copy `apps/ai/.env.example` to `apps/ai/.env`:

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | At least 1 | `your_gemini_key` | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-3.8-flash` | Gemini model name |
| `GEMINI_TIMEOUT_SECONDS` | No | `60` | Model call timeout |
| `GROQ_API_KEY` | Optional | `your_groq_key` | Alternative Groq provider API key |
| `GROQ_MODEL` | No | `openai/gpt-oss-120b` | Groq model identifier |
| `MAX_INPUT_CHARS` | No | `200000` | Maximum prompt payload characters |

---

## 4. Local Startup Procedure

### Step 1: Start Backing Services via Docker Compose
From the repository root:
```bash
docker compose up -d
```
Verify containers are healthy:
```bash
docker compose ps
```
- `quiz-postgres`: port 5432 with health check `pg_isready -U TestUser -d quiz_platform`
- `quiz-redis`: port 6379 with health check `redis-cli ping` and AOF persistence

### Step 2: Run Database Migrations
Migrations must be executed explicitly:
```bash
cd apps/api
npm run migration:run
```

### Step 3: Start the Backend (NestJS)
```bash
cd apps/api
npm run start:dev
```
The NestJS server listens on port `3000`.

### Step 4: Start the AI Generation Service (FastAPI)
```bash
cd apps/ai
# Activate Python virtual environment
.\.venv\Scripts\activate   # Windows
# or: source .venv/bin/activate # Linux/macOS
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Step 5: Start the Frontend (Vite)
```bash
cd apps/web
npm run dev
```
The client application is available at `http://localhost:5173`.

---

## 5. Database Migration Strategy & Safe Recovery

### 5.1 Explicit Migration Execution Policy
- **Synchronize Disabled**: `synchronize: false` is permanently enforced across all environments. Automatic schema mutation is strictly prohibited.
- **Explicit Execution**: Migrations are never run automatically on application startup. In containerized or multi-pod deployments, automatic migrations trigger concurrent schema mutation race conditions.
- **Command**:
  ```bash
  npm run migration:run
  ```
- **Revert**:
  ```bash
  npm run migration:revert
  ```

### 5.2 Backup & Restore Procedure (PostgreSQL)
To capture a point-in-time snapshot before applying migrations or deploying releases:

#### Backup (Logical Dump)
```bash
# Using Docker Compose container
docker exec -t quiz-postgres pg_dump -U TestUser -d quiz_platform -Fc > backup_$(date +%Y%m%d_%H%M%S).dump

# Or using host CLI
pg_dump -h localhost -p 5432 -U TestUser -Fc -d quiz_platform > backup_$(date +%Y%m%d_%H%M%S).dump
```

#### Restore
```bash
# Drop active connections & restore
docker exec -i quiz-postgres pg_restore -U TestUser -d quiz_platform --clean --if-exists < backup_file.dump
```

### 5.3 Queue Recovery (Redis)
- Redis is configured with `redis-server --appendonly yes` and volume `redis_data:/data`.
- In-flight BullMQ jobs that fail during a crash or node restart automatically re-enter the queue according to configured retry policies (3 attempts with exponential backoff).
- If Redis is unreachable when a job is scheduled, `QuizGenerationService` catches the connection error, transitions the `quiz_question_generations` database row to `FAILED`, removes temporary PDF files, and prevents orphaned `PENDING` states.

---

## 6. Verification & Test Execution

Run all test suites before cutting a release:

### 6.1 Backend Unit Tests
```bash
npm --prefix apps/api test
```
*Current result: 302/302 tests passing across 22 test files.*

### 6.2 Live Database & Redis Integration Tests
*Requires PostgreSQL (port 5432) and Redis (port 6379) running.*
```bash
npm --prefix apps/api run test:integration
```
*Current result: 14/14 scenarios passing against live PostgreSQL & Redis.*

### 6.3 AI Service Python Tests
```bash
cd apps/ai
.\.venv\Scripts\activate
pytest
```
*Current result: 18/18 tests passing.*

### 6.4 Frontend Unit & Contract Tests
```bash
node --test apps/web/tests/*.test.ts
```
*Current result: 85/85 tests passing across 12 test suites.*

### 6.5 Linters & Production Builds
```bash
npm --prefix apps/api run lint
npm --prefix apps/web run lint
npm --prefix apps/api run build
npm --prefix apps/web run build
```

---

## 7. Observability, Health Checks & Operational Signals

### 7.1 Health Endpoint (`GET /health`)
The health probe is exposed publicly without authentication at `GET http://<host>:3000/health`:
```json
{
  "status": "ok",
  "info": {
    "api": { "status": "up" },
    "database": { "status": "up" },
    "ai": { "status": "up", "service": "ai" }
  },
  "error": {},
  "details": {
    "api": { "status": "up" },
    "database": { "status": "up" },
    "ai": { "status": "up", "service": "ai" }
  }
}
```
If PostgreSQL is down, the response returns HTTP 503 with `"database": { "status": "down" }`.
If the AI service is unreachable, it returns HTTP 503 with `"ai": { "status": "down" }`.

### 7.2 Minimum Operational Alerts
For production operations, alert on:
1. `/health` returning HTTP 503 or non-200 for > 3 consecutive checks (15s interval).
2. PostgreSQL active connections > 80% of `max_connections`.
3. Redis memory usage > 80% of `maxmemory`.
4. BullMQ `ai-question-generation` failed jobs count > 10 in 5 minutes.
5. Auth endpoint 429 rate limit spikes (indicating credential stuffing / DDoS attempt).

---

## 8. Troubleshooting Common Failures

### 1. PostgreSQL Connection Refused on `127.0.0.1:5432`
- Verify container status: `docker compose ps`.
- Check logs: `docker compose logs postgres`.
- Ensure port 5432 is not occupied by another local PostgreSQL instance.

### 2. Redis Connection Refused on `127.0.0.1:6379`
- Verify container status: `docker compose ps redis`.
- Test connection: `docker exec -it quiz-redis redis-cli ping` (should output `PONG`).

### 3. AI Service Fails with `Neither GEMINI_API_KEY nor GROQ_API_KEY is set`
- Add a valid key to `apps/ai/.env`.
- Ensure you activated `.venv` or set system environment variables.

### 4. Windows Sandbox `EPERM: operation not permitted` on `mkdir`
- On Windows, anti-virus or indexers occasionally lock transient `.vite-temp` directories.
- Clean `.vite-temp` or retry command up to twice before treating as an access failure.
