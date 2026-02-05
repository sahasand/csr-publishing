# CLAUDE.md

## Project Overview

CSR Publishing - A clinical study report (CSR) document management and eCTD packaging tool for regulatory submissions. Built with Next.js 16, Prisma 7, and SQLite.

**Repository**: https://github.com/sahasand/csr-publishing

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite with Prisma 7 (driver adapter pattern)
- **UI**: React 19, Tailwind CSS 4, Radix UI (TraceScribe theme)
- **State**: Zustand, TanStack Query
- **PDF**: pdf-lib for processing
- **Testing**: Vitest

## Key Architecture Decisions

- **SQLite**: Single-file database for simplicity (small team internal tool)
- **Direct processing**: Document metadata extraction happens synchronously during upload (no job queue)
- **Prisma 7**: Uses `@prisma/adapter-better-sqlite3` driver adapter
- **JSON as strings**: SQLite doesn't support JSON type natively; `params` and `validationRules` are stored as JSON strings

## Common Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run test         # Run tests (Vitest)
npm run test:run     # Run tests once
npm run lint         # ESLint

npx prisma generate  # Regenerate Prisma client
npx prisma migrate dev --name <name>  # Create migration
npx prisma studio    # Open database GUI

npx tsx prisma/seed-template.ts        # Seed default CSR template
npx tsx prisma/seed-validation-rules.ts # Seed PDF validation rules
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── studies/       # Study CRUD
│   │   ├── documents/     # Document management
│   │   ├── templates/     # Structure templates
│   │   ├── upload/        # File upload + processing
│   │   ├── jobs/          # Processing job status
│   │   └── validation-rules/
│   ├── studies/           # Study pages
│   └── templates/         # Template pages
├── lib/
│   ├── db.ts              # Prisma client (SQLite adapter)
│   ├── storage.ts         # File storage utilities
│   ├── process-document.ts # Direct document processing
│   ├── standard-sections.ts # ICH E3 Module 16 section definitions
│   ├── validation/        # PDF validation checks
│   ├── packaging/         # eCTD package generation
│   └── jobs/              # Job handlers (metadata, validation)
├── generated/
│   └── prisma/            # Generated Prisma client (don't edit)
├── components/            # React components
├── types/                 # TypeScript types
└── __tests__/            # Test files
```

## Database Schema (Key Models)

- **Study**: Clinical study with protocol number
- **StructureTemplate**: eCTD folder structure template
- **StructureNode**: Nodes in the template tree (sections/slots)
- **Document**: Uploaded documents linked to study + slot
- **ProcessingJob**: Tracks document processing status
- **ValidationRule/Result**: PDF validation rules and results
- **Annotation**: Document review comments

## Prisma Notes

- Client generated to `src/generated/prisma/`
- Import from `@/generated/prisma/client` (not `@prisma/client`)
- Schema at `prisma/schema.prisma`
- Config at `prisma.config.ts`

```typescript
// Correct import pattern
import { PrismaClient, Prisma } from '@/generated/prisma/client';
```

## Environment Variables

```env
DATABASE_URL="file:./dev.db"    # SQLite database path
UPLOAD_DIR="./uploads"          # Uploaded files directory
```

## Testing

Tests use Vitest with mocked Prisma client. Run specific test:
```bash
npm run test -- src/__tests__/api/studies.test.ts
```

## Deployment (Railway)

Requires persistent volume at `/data`:
```env
DATABASE_URL=file:/data/csr.db
UPLOAD_DIR=/data/uploads
```

## ICH E3 Standard Sections

Templates can be created with pre-populated ICH E3 Module 16 sections (18 standard CSR sections). The section definitions live in `src/lib/standard-sections.ts` and include:

- **16.1.x**: Protocol documents (Study Protocol, Case Report Form, Informed Consent, etc.)
- **16.2.x**: Data listings (Patient Demographics, Protocol Deviations, Efficacy/Safety Data)
- **16.3.x**: Publications

When creating a template via the UI, check "Start with ICH E3 standard sections" to auto-populate. The API accepts `useStandardSections: true` in POST `/api/templates`.

## Code Conventions

- API routes return `{ data: ... }` or `{ error: "message" }`
- Use `db` from `@/lib/db` for database access
- UUID validation regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
- JSON fields stored as strings - use `JSON.stringify()` on write, `JSON.parse()` on read

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First:** Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan:** Check in before starting implementation
3. **Track Progress:** Mark items complete as you go
4. **Explain Changes:** High-level summary at each step
5. **Document Results:** Add review section to `tasks/todo.md`
6. **Capture Lessons:** Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First:** Make every change as simple as possible. Impact minimal code.
- **No Laziness:** Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact:** Changes should only touch what's necessary. Avoid introducing bugs.
