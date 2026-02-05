# AGENTS.md

## Project Overview
- CSR Publishing is a clinical study report (CSR) document management and eCTD packaging tool for regulatory submissions.
- Stack: Next.js 16 (App Router), React 19, Tailwind CSS 4, Radix UI, Prisma 7 + SQLite.
- PDF processing uses `pdf-lib`; validation and packaging live under `src/lib`.

## Repo Map
- `src/app` App Router pages
- `src/app/api` API routes
- `src/components` shared UI components
- `src/hooks` client hooks and state helpers
- `src/lib` core services (db, storage, processing, packaging, pdf, validation)
- `src/lib/jobs` background processing (metadata extraction, PDF conversion/validation)
- `src/types` shared TypeScript types
- `src/__tests__` Vitest test suites
- `src/generated/prisma` generated Prisma client (do not edit)
- `prisma/schema.prisma` database schema
- `docs/plans` project planning references
- `scripts` local test utilities (PDF/XML processing)
- `uploads` uploaded files (runtime data)
- `exports` generated eCTD packages (runtime data)
- `tasks/todo.md` and `tasks/lessons.md` project planning and lessons

## Data Flow
- Upload to metadata extraction in `src/lib/process-document.ts`.
- Background extraction/conversion/validation jobs live in `src/lib/jobs`.
- Export orchestration in `src/lib/packaging/exporter.ts`, writing packages under `exports`.
- XML backbone in `src/lib/packaging/xml-generator.ts` with templates in `src/lib/packaging/xml-templates`.
- PDF compliance tooling in `src/lib/pdf` and `src/lib/validation`.

## Prisma and DB
- Import Prisma client from `@/generated/prisma/client`; use `db` from `@/lib/db`.
- SQLite stores JSON as strings; use `JSON.stringify()` and `JSON.parse()`.
- Default `DATABASE_URL="file:./dev.db"`.

## Environment
- `.env.example` defines `DATABASE_URL` and `UPLOAD_DIR`.
- Ensure `uploads` and `exports` are writable in the runtime environment.

## Commands
- `npm run dev`, `npm run build`, `npm run start`
- `npm run lint`
- `npm run test`, `npm run test:run`, `npm run test:coverage`
- `npx prisma generate`
- `npx prisma migrate dev --name <name>`

## Conventions
- API routes return `{ data: ... }` on success or `{ error: "message" }` on failure with proper status codes.
- Use the `@/*` path alias for `src/*`.
- Avoid editing generated code in `src/generated/prisma`.

## Workflow Notes
- For non-trivial work, capture a plan in `tasks/todo.md`.
- After corrections, note learnings in `tasks/lessons.md`.
