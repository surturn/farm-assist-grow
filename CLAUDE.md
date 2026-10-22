# farm-assist-grow (FarmAssist)

Crop diagnosis for farmers: photo in, short plain-language diagnosis out, delivered over WhatsApp and a web app.

## Stack and layout
npm workspaces monorepo.
- `apps/frontend`: React, Vite, TypeScript, Tailwind, TanStack Query, shadcn-ui.
- `apps/backend`: Express, TypeScript, PostgreSQL (Prisma), Firebase Admin auth, Redis.
- `packages/ai`, `packages/database`, `packages/firebase-admin`, `packages/shared-types`.
- `AImodel/` model work, `infrastructure/redis/`, `docs/`.
- One shared `.env.local` at the repo root feeds frontend and backend (see README for keys). Never commit it.

## Commands
- `npm run dev` runs frontend and backend together. `dev:frontend` and `dev:backend` run one each.
- `docker-compose.yml` is the Docker setup (see README for what it starts).

## Rules
- Diagnosis uses a closed label set with guardrails. Priority diseases and look-alike answers cite sources.
- WhatsApp replies: English by default, farmer can pick a language, short answer first with details on request.
- `firebase-debug.log` at the root is noise, do not commit.

## Graph
`graphify-out/` has a graph (local). Use `graphify query "..."` before reading many files.

## Deploy
Docker Compose. Sydney's standing rule is Railway for production. Confirm target before deploying.

## Session state (update at the end of each session)
- 2026-10-09: PR 30 (diagnosis pipeline) merged to `main`. Local branch `feat/short-replies` is ahead with the short-reply work.
- Next: open a PR for `feat/short-replies`.

## Verify (see global rule: drive it like a user, mobile 390x844 and desktop 1440x900, screenshots, fix until it works)
- `npm run dev`. Upload a crop photo in the web app, check the diagnosis and the short reply. For WhatsApp, post a test webhook payload and check the reply text and language choice.

## Caveman mode (always on)
Reply in caveman style: answer first, no filler, all technical facts kept. Follow the `caveman:caveman` skill rules where installed. Stays on until the user says "stop caveman" or "normal mode". Full sentences for security warnings, irreversible actions, questions to the user, and anything written to files, commits, PRs or docs.
