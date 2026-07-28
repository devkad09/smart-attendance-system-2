# Smart Biometric Attendance System

A full-stack web app for tracking school attendance via simulated fingerprint scanning. Staff enroll students, simulate daily scans, and monitor live attendance stats on a dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/attendance-app run dev` — run the frontend (port 19377)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, TanStack Query, wouter, Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/students.ts` — students table
- `lib/db/src/schema/attendance.ts` — attendance records table
- `artifacts/api-server/src/routes/students.ts` — enrollment endpoints
- `artifacts/api-server/src/routes/attendance.ts` — scan, stats, weekly, by-class endpoints
- `artifacts/attendance-app/src/` — React frontend

## Architecture decisions

- Fingerprint capture is simulated: enrolling a student generates a random hex template. Replace `simulateFingerprintCapture()` in `routes/students.ts` with a real SDK call when hardware is available.
- "On-time" is before 08:15; "late" is at or after 08:15. Configured in `computeStatus()` in `routes/attendance.ts`.
- One attendance record per student per day — duplicate scans return 200 with the existing record.
- Weekly trend and per-class breakdown are server-computed aggregations; the frontend uses dedicated hooks.

## Product

- **Dashboard** — live stats (total/present/absent/on-time/late), weekly trend chart, per-class breakdown, today's live log. Auto-refreshes every 10 seconds.
- **Students** — searchable list of enrolled students with class badges; enroll new students via form.
- **Scanner** — select a student, press the scan button; instant feedback (on-time / late / already-scanned).

## User preferences

_Populate as needed._

## Gotchas

- After changing `lib/db/src/schema/`, run `pnpm run typecheck:libs` before artifact typechecks or imports will fail.
- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` before using the generated hooks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
