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

---

## 9. 12-Point Beta Smoke Test Checklist

The following 12 smoke tests form the core release validation gate before admitting beta cohorts.

| # | Domain / Capability | Verification Method | Expected Outcome | Citations (Tests / Code / Endpoints) |
|---|---------------------|---------------------|------------------|--------------------------------------|
| **1** | **User Authentication & Throttling** | Automated & Manual | • Register/login issues valid access token (15m) & HTTP-only refresh token.<br>• Password & refresh token hashes omitted from user responses.<br>• Exceeding 10 attempts/min returns HTTP 429 with `Retry-After`.<br>• Frontend intercepts 401 and refreshes or redirects without infinite loops. | • `auth.service.spec.ts`<br>• `auth-throttler.guard.spec.ts`<br>• `POST /auth/login`<br>• `POST /auth/register`<br>• `apps/web/src/lib/api-client.ts` |
| **2** | **Quiz Creation & Draft Editing** | Automated & Manual | • Creator creates quiz with draft version 1.<br>• Edits to title, description, time limit, and questions mutate draft only.<br>• Single-draft-per-quiz constraint strictly enforced (HTTP 409 if duplicate draft attempted). | • `quizzes.service.spec.ts`<br>• `quiz-editing-version-integrity.test.ts`<br>• `POST /quizzes`<br>• `PUT /quizzes/:id/draft` |
| **3** | **AI Generation from Prompt** | Automated & Manual | • Creator inputs prompt; API dispatches BullMQ background job.<br>• Returns HTTP 202 with `generationId` and status `PENDING`.<br>• Polling transitions to `COMPLETED` with validated questions, options, and explanations.<br>• Raw prompt and sensitive parameters redacted in server logs. | • `ai.service.spec.ts`<br>• `test_workflow.py`<br>• `POST /quizzes/generate-questions`<br>• `GET /quizzes/generations/:id` |
| **4** | **AI Generation from PDF** | Automated & Manual | • Creator uploads PDF document (<= 10MB).<br>• Magic bytes `%PDF-` validated; non-PDF rejected with HTTP 400.<br>• Worker extracts text, generates questions, and deletes temporary PDF immediately upon job completion or failure. | • `ai-pdf-storage.service.spec.ts`<br>• `POST /quizzes/generate-from-pdf`<br>• `apps/api/uploads/ai-source-pdfs` |
| **5** | **AI Failure & Recovery** | Automated (Unit & Mock) | • Upstream AI timeout or 503 triggers up to 3 BullMQ retries with exponential backoff.<br>• Terminal failure transitions database generation record to `FAILED` with sanitized error message.<br>• Temporary disk files purged; creator sees actionable retry alert in UI. | • `ai-question-generation.processor.spec.ts`<br>• `quiz-question-generation.entity.ts`<br>• `AiService.handleFailure()` |
| **6** | **Question Review & Apply** | Automated & Manual | • Creator reviews generated questions, modifies wording, toggles correct options, or discards items.<br>• Applying valid questions appends them transactionally to the active draft version with sequential order indices. | • `quizzes.service.spec.ts`<br>• `review-validation.test.ts`<br>• `POST /quizzes/:id/draft/questions/bulk` |
| **7** | **Publication & Version Integrity** | Automated (Integration) | • Readiness validation blocks publishing if questions lack correct options or quiz has 0 questions.<br>• Successful publication locks version to `PUBLISHED` and bumps quiz live version pointer.<br>• Subsequent edits spawn draft version (v2); published version remains strictly immutable. | • Scenario 10 in `quiz-lifecycle.integration.spec.ts`<br>• `quizzes.service.spec.ts`<br>• `POST /quizzes/:id/publish` |
| **8** | **Learner Discovery & Access Controls** | Automated (Integration) | • Learner catalog lists only `PUBLISHED` quizzes.<br>• Private organization quizzes inaccessible to learners outside organization (HTTP 403).<br>• Quizzes with future `availableFrom` or past `availableTo` hidden or blocked. | • Scenario 12 in `quiz-lifecycle.integration.spec.ts`<br>• `GET /quizzes/catalog`<br>• `GET /quizzes/:id/pre-attempt` |
| **9** | **Timed Attempts, Saving, & Expiration** | Automated (Integration) | • Attempt creation snapshots current published version schema.<br>• Answer submission saves selections idempotently.<br>• Server enforces deadline using `SELECT FOR UPDATE` row lock.<br>• Answers submitted past `deadlineAt` rejected with HTTP 400 `ATTEMPT_EXPIRED`. | • Scenarios 2, 3, 4 in `quiz-lifecycle.integration.spec.ts`<br>• `POST /quizzes/:id/attempts`<br>• `PUT /attempts/:attemptId/answers`<br>• `POST /attempts/:attemptId/submit` |
| **10** | **Results, History, & Creator Analytics** | Automated (Integration) | • All-or-nothing scoring evaluates attempts automatically.<br>• Learner sees earned score, percentage, and option-level explanations.<br>• Creator analytics dashboard aggregates total attempts, pass rate, average score, and question difficulty distribution. | • Scenarios 11 & 13 in `quiz-lifecycle.integration.spec.ts`<br>• `GET /attempts/:id/results`<br>• `GET /quizzes/:id/analytics` |
| **11** | **Classroom & Assignment BOLA Authorization** | Automated (Unit & Integration) | • Teachers can only manage classrooms and assignments they own.<br>• Cross-tenant or unauthorized teacher updates rejected with HTTP 403 Forbidden.<br>• Non-teacher roles blocked from teacher dashboard endpoints. | • `classroom.service.spec.ts`<br>• `quiz-assignment.service.spec.ts`<br>• `roles.guard.ts`<br>• `PATCH /classrooms/:id` |
| **12** | **Dependency Outage Behavior** | Automated & Manual | • Database failure causes `/health` to return HTTP 503 (`database: down`).<br>• AI service outage flags `/health` HTTP 503 (`ai: down`), while quiz viewing and evaluation continue functioning normally.<br>• Redis outage prevents new job queuing but gracefully transitions API response without crashing server process. | • `health.controller.spec.ts`<br>• `GET /health`<br>• `AiService` catch block |

---

## 10. Failed BullMQ & AI Job Triage Guide

### 10.1 Inspecting BullMQ Queues via Redis CLI
When an AI question generation task appears stuck in `PENDING` or fails:

1. **Connect to Redis**:
   ```bash
   docker exec -it quiz-redis redis-cli
   ```
2. **Inspect Queue Job Counts**:
   ```redis
   KEYS bull:ai-question-generation:*
   HGETALL bull:ai-question-generation:counts
   ```
3. **Inspect Failed Job Details**:
   ```redis
   ZRANGE bull:ai-question-generation:failed 0 -1 WITHSCORES
   HGETALL bull:ai-question-generation:<jobId>
   ```
4. **Reconcile Orphaned Jobs**:
   If a worker was terminated mid-execution, inspect `quiz_question_generations` table:
   ```sql
   SELECT id, quiz_id, status, error_message, updated_at 
   FROM quiz_question_generations 
   WHERE status = 'PENDING' AND updated_at < NOW() - INTERVAL '10 minutes';
   ```

### 10.2 Investigating Upstream AI Inference Failures
1. Check FastAPI logs:
   ```bash
   # In apps/ai terminal or container logs
   uvicorn app.main:app
   ```
2. Verify Provider Response:
   - Check if rate limit (HTTP 429) was hit on Google Gemini or Groq.
   - Verify token usage and timeout thresholds.
   - Ensure input text character count does not exceed `MAX_INPUT_CHARS` (200,000).

---

## 11. Application Rollback Runbook

If an unrecoverable defect is detected during beta rollout:

### Step 1: Revert API / Web Releases
```bash
# Checkout previous stable Git commit or tag
git checkout <previous_stable_tag>

# Rebuild frontend and backend assets
npm --prefix apps/api run build
npm --prefix apps/web run build

# Restart service processes
```

### Step 2: Database Migration Revert (If Migration Applied)
```bash
cd apps/api
npm run migration:revert
```
*Note: Only revert if the migration rollback script does not drop populated user or attempt data.*

### Step 3: Point-in-Time Database Restoration (Disaster Recovery)
If schema corruption occurred:
```bash
# 1. Terminate active backend processes to release database locks
# 2. Restore verified snapshot
docker exec -i quiz-postgres pg_restore -U TestUser -d quiz_platform --clean --if-exists < backup_pre_release.dump
```

---

## 12. Beta Feedback Collection & Prioritization Framework

### 12.1 Feedback Channels
- **In-App Issue Reporting**: UI header link to GitHub Issues or feedback modal.
- **Error Tracking**: Client-side unhandled rejection logs and API HTTP 500 monitoring.

### 12.2 Severity Classification & SLA
- **P0 — Critical (Blocker)**: Complete service outage, data corruption, auth bypass, attempt submission failure.
  - *SLA*: Immediate rollback or hotfix within 2 hours.
- **P1 — High**: AI generation failure for specific prompt shapes, timeout on large quizzes, analytics aggregation inaccuracy.
  - *SLA*: Fix within 24 hours.
- **P2 — Medium**: Minor UI alignment defects, non-critical validation error clarity, cosmetic rendering anomalies.
  - *SLA*: Next scheduled beta patch.
- **P3 — Low**: Enhancement requests, additional question types, workflow optimizations.
  - *SLA*: Backlog for General Availability (GA).
