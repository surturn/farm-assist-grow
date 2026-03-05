# FarmAssist

FarmAssist has been restructured from a monolithic Vite project into a scalable **Monorepo** architecture separating concerns between a feature-driven React frontend and a layered Express/Prisma backend.

## Tech Stack Overview
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, TanStack Query, shadcn-ui
- **Backend**: Express, TypeScript, PostgreSQL (Prisma ORM), Firebase Admin Auth, Redis (Caching & Rate Limiting)
- **Deployment**: Docker Compose

## Setting up Environment Variables
A shared `.env.local` file at the root powers both the frontend and backend. Ensure it includes:

```env
# Backend Database and Cache
DATABASE_URL="postgresql://postgres:password@localhost:5432/farmassist"
REDIS_URL="redis://localhost:6379"

# Shared OpenAI (consumed securely by the backend)
OPENAI_API_KEY="your_openai_key"

# Frontend/Backend Firebase Configuration (Client & Admin)
VITE_FIREBASE_API_KEY="..."
FIREBASE_PROJECT_ID="..."
FIREBASE_CLIENT_EMAIL="..."
FIREBASE_PRIVATE_KEY="..."

# Example URL variables
VITE_API_URL="http://localhost:5000/api/v1"
PORT=5000
```

## Running Locally (Development)

1. **Install Dependencies:**
   Install dependencies for the entire workspace from the root.
   ```bash
   npm install
   ```

2. **Start Database and Redis:**
   You can run Local Postgres/Redis via Docker or run your own manual setups.
   ```bash
   docker-compose up -d postgres redis
   ```

3. **Database Migration:**
   Apply the Prisma schema to the database.
   ```bash
   npm run build --workspace=backend
   npx prisma db push --schema=./backend/prisma/schema.prisma
   ```

4. **Start the Applicaitons:**
   Run both frontend and backend concurrently from the root directory.
   ```bash
   npm run dev
   ```
   - **Frontend:** http://localhost:5173
   - **Backend API:** http://localhost:5000/health

## Running via Docker Compose (Production Build)

To build and spin up the complete Stack (Postgres, Redis, Express Backend, Nginx Frontend):
```bash
docker-compose up --build -d
```
The Frontend will be exposed on port `80` while the backend API is routed internally via port `5000`.
