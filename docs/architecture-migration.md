# FarmAssist Refactor Blueprint (Frontend + Backend)

## 1) Target Project Folder Structure

```txt
.
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── cache/
│   │   │   └── redis.ts
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   └── firebase-admin.ts
│   │   ├── controllers/
│   │   │   └── farms.controller.ts
│   │   ├── db/
│   │   │   └── prisma.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   ├── rate-limit.middleware.ts
│   │   │   └── validate.middleware.ts
│   │   ├── routes/
│   │   │   ├── farms.routes.ts
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── ai.service.ts
│   │   │   ├── crops.service.ts
│   │   │   └── farms.service.ts
│   │   ├── validators/
│   │   │   ├── crop.validator.ts
│   │   │   └── farm.validator.ts
│   │   └── utils/
│   └── tsconfig.json
├── prisma/
│   └── schema.prisma
├── src/
│   ├── assets/
│   ├── components/
│   │   └── ui/
│   ├── common/
│   ├── features/
│   │   ├── auth/
│   │   ├── crops/
│   │   │   └── api.ts
│   │   ├── farms/
│   │   │   └── api.ts
│   │   ├── notifications/
│   │   ├── planning/
│   │   └── scan/
│   ├── hooks/
│   ├── layout/
│   ├── lib/
│   │   └── query-client.ts
│   ├── pages/
│   ├── router/
│   │   └── index.tsx
│   ├── services/
│   │   ├── ai/
│   │   ├── api/
│   │   │   └── client.ts
│   │   ├── firebase/
│   │   │   └── token.ts
│   │   └── weather/
│   ├── types/
│   │   └── api.ts
│   ├── App.tsx
│   └── main.tsx
└── docs/
    └── architecture-migration.md
```

## 2) Key Code Files and Why They Exist

- **`backend/src/middleware/auth.middleware.ts`**: verifies Firebase ID tokens, caches decoded claims in Redis, and attaches user context for downstream controllers.
- **`src/services/api/client.ts`**: typed frontend API client that always includes auth token and centralizes HTTP error handling.
- **`backend/src/db/prisma.ts` + `prisma/schema.prisma`**: singleton Prisma setup and core domain models (User, Farm, FarmMember, Crop, Task, Notification).
- **`backend/src/cache/redis.ts`**: shared Redis connection used for cache and rate limiting.
- **`backend/src/routes/farms.routes.ts` + `backend/src/controllers/farms.controller.ts`**: sample production-style Farms/Crops route implementation with validation.

## 3) Step-by-Step Migration Plan (No Downtime, Low Risk)

### Step 1 — Establish backend skeleton beside existing app
- **Files to create**
  - `backend/src/*` layered folders with app bootstrap (`app.ts`, `server.ts`), middleware, routes, services.
- **Files to move**
  - Keep current `server.js` unchanged initially; do not move yet.
- **Code modifications required**
  - Introduce independent backend startup on `:4000`.
  - Add `/api/health` and basic auth/rate-limit/error middleware.
- **Testing checkpoint**
  - `curl http://localhost:4000/api/health` returns 200.

### Step 2 — Add database layer and domain schema
- **Files to create**
  - `prisma/schema.prisma`, `backend/src/db/prisma.ts`.
- **Files to move**
  - None.
- **Code modifications required**
  - Add User/Farm/FarmMember/Crop/Task/Notification models.
  - Generate Prisma client and run first migration.
- **Testing checkpoint**
  - `npx prisma validate` and `npx prisma migrate dev` succeed.

### Step 3 — Introduce auth boundary (Firebase -> backend)
- **Files to create**
  - `backend/src/config/firebase-admin.ts`, `backend/src/middleware/auth.middleware.ts`.
- **Files to move**
  - None.
- **Code modifications required**
  - Verify bearer token server-side.
  - Cache decoded token (`firebase:token:*`) in Redis.
- **Testing checkpoint**
  - Unauthorized requests return 401; valid token calls succeed.

### Step 4 — Move farms/crops APIs into layered backend
- **Files to create**
  - `validators/*.ts`, `services/*.ts`, `controllers/farms.controller.ts`, `routes/farms.routes.ts`.
- **Files to move**
  - Any farm/crop logic currently embedded in frontend pages (migrate incrementally to API calls).
- **Code modifications required**
  - Apply Zod validation at route boundary.
  - Keep all DB access inside services only.
- **Testing checkpoint**
  - Contract tests for `GET/POST /api/farms` and `GET/POST /api/farms/:farmId/crops`.

### Step 5 — Move AI/weather third-party calls to backend
- **Files to create**
  - `backend/src/services/ai.service.ts`, later `weather.service.ts`.
- **Files to move**
  - Frontend third-party direct calls from `src/lib/*` into backend service calls.
- **Code modifications required**
  - Frontend calls backend endpoints only.
  - Cache expensive responses in Redis (`ai:*`, `weather:*`).
- **Testing checkpoint**
  - Simulated duplicate request hits cache; no key leakage in frontend bundle.

### Step 6 — Frontend feature-driven migration
- **Files to create**
  - `src/features/*/api.ts`, `src/services/api/client.ts`, `src/router/index.tsx`, `src/lib/query-client.ts`.
- **Files to move**
  - Migrate one page at a time (Farms → Planning → Scan) into feature modules.
- **Code modifications required**
  - Replace local `fetch` with typed API client + TanStack Query hooks.
  - Keep page components thin; push logic into feature modules.
- **Testing checkpoint**
  - Route smoke tests and API integration tests (mocked + dev backend).

### Step 7 — Rate limiting, hardening, and observability
- **Files to create**
  - Optional `backend/src/utils/logger.ts` and request-id middleware.
- **Files to move**
  - None.
- **Code modifications required**
  - Add helmet + Redis rate limiter globally.
  - Normalize API error format.
- **Testing checkpoint**
  - Burst tests confirm 429 response and recovery after window.

### Step 8 — Deployment with horizontal scaling
- **Files to create**
  - `Dockerfile.frontend`, `Dockerfile.backend`, `docker-compose.yml`.
- **Files to move**
  - Remove/retire old monolithic `server.js` once backend cutover is complete.
- **Code modifications required**
  - Stateless backend instances (no in-memory sessions).
  - Shared Redis + PostgreSQL for all instances behind load balancer.
- **Testing checkpoint**
  - Run multiple backend instances and verify consistent auth/cache behavior.

## 4) Local Run Instructions

1. Create `.env` for backend with:
   - `DATABASE_URL`, `REDIS_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `OPENAI_API_KEY`, `WEATHER_API_KEY`, `PORT=4000`.
2. Start infra:
   - PostgreSQL and Redis (Docker recommended).
3. Apply schema:
   - `npx prisma generate`
   - `npx prisma migrate dev --name init`
4. Run backend:
   - `npx tsx backend/src/server.ts`
5. Run frontend:
   - `npm run dev`
   - Set `VITE_API_BASE_URL=http://localhost:4000/api`.

## 5) Docker Deployment Instructions

- Build separate images for frontend and backend.
- Deploy backend as multiple replicas behind a load balancer.
- Use managed PostgreSQL + Redis.
- Secrets are injected as env vars at runtime (never baked into frontend build).
- Health check endpoint: `/api/health`.
