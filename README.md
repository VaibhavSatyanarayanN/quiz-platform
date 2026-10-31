# AI-Powered Quiz Platform

An enterprise-ready, AI-augmented assessment platform built with a modular architecture:
- **Backend API**: NestJS (Modular Monolith) with TypeORM, PostgreSQL 16, and BullMQ background queuing on Redis 7.
- **Frontend SPA**: React 19, TypeScript, and Vite.
- **AI Inference Engine**: Python FastAPI multi-agent question generation service.

## Quickstart

### 1. Backing Infrastructure
Start PostgreSQL and Redis via Docker Compose:
```bash
docker compose up -d
```

### 2. Environment Setup
Copy the example environment files:
```bash
# Backend API
cp apps/api/.env.example apps/api/.env

# Frontend Web
cp apps/web/.env.example apps/web/.env

# AI Service
cp apps/ai/.env.example apps/ai/.env
```
Edit `apps/ai/.env` to include your `GEMINI_API_KEY`.

### 3. Database Migration
Run migrations explicitly:
```bash
npm --prefix apps/api run migration:run
```

### 4. Start Services
- **Backend**: `npm --prefix apps/api run start:dev` (Port 3000)
- **AI Service**: `cd apps/ai && .\.venv\Scripts\activate && uvicorn app.main:app --port 8000 --reload` (Port 8000)
- **Frontend**: `npm --prefix apps/web run dev` (Port 5173)

## Complete Documentation & Operations Guide

For complete deployment topology, environment variable reference, backup & restore procedures, health checks, and troubleshooting, consult:
- [`docs/deployment_and_operations.md`](file:///D:/Self/quiz-platform/docs/deployment_and_operations.md)
