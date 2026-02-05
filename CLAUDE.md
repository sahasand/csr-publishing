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
- **PDF-only uploads**: Only PDF files are accepted; no document conversion (keeps deployment simple)
- **Prisma 7**: Uses `@prisma/adapter-better-sqlite3` driver adapter
- **JSON as strings**: SQLite doesn't support JSON type natively; `params` and `validationRules` are stored as JSON strings

## Quick Start (First Time)

```bash
git clone https://github.com/sahasand/csr-publishing.git
cd csr-publishing
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npx tsx prisma/seed-template.ts
npx tsx prisma/seed-validation-rules.ts
npm run dev
```

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
- **DocumentStatusHistory**: Audit trail of document status transitions
- **ProcessingJob**: Tracks document processing status
- **ValidationRule/Result**: PDF validation rules and results
- **Annotation**: Document review comments

## Document Workflow

Documents follow a status workflow for review and approval:

```
DRAFT → IN_REVIEW → APPROVED → PUBLISHED
              ↓          ↓          ↓
        CORRECTIONS_NEEDED ←────────┘
```

### Status Transitions

| From | To | Comment Required |
|------|-----|------------------|
| DRAFT/PROCESSED | IN_REVIEW | No |
| IN_REVIEW | APPROVED | No |
| IN_REVIEW | CORRECTIONS_NEEDED | Yes |
| APPROVED | PUBLISHED | No |
| APPROVED | CORRECTIONS_NEEDED | Yes |
| PUBLISHED | CORRECTIONS_NEEDED | Yes |
| CORRECTIONS_NEEDED | IN_REVIEW | No |

### Workflow API

```typescript
// Transition document status
POST /api/documents/[id]/transition
Body: { toStatus: "IN_REVIEW", comment?: string, userName?: string }

// Get status history
GET /api/documents/[id]/history
```

### Workflow Components

- **StatusBadge**: Displays document status with colored badge
- **WorkflowActions**: Transition buttons based on current status
- **StatusHistory**: Audit trail showing all status changes

```typescript
import { StatusBadge, WorkflowActions, StatusHistory } from '@/components/workflow';
```

### Export Validation

Export warns if documents are not APPROVED or PUBLISHED. Force export available for override.

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

Configured via `railway.toml`. Uses SQLite with persistent volume at `/data`.

### Step 1: Initial Setup

```bash
# Login and create project
railway login
railway init

# Link to existing project (if already created in dashboard)
railway link
```

### Step 2: Add Persistent Volume

**Critical**: SQLite data is lost on redeploy without a volume.

```bash
railway volume add --mount /data
```

Or via Railway Dashboard: Project → Settings → Volumes → Add Volume → Mount path: `/data`

### Step 3: Set Environment Variables

In Railway Dashboard → Variables, add:

```env
DATABASE_URL=file:/data/csr.db
UPLOAD_DIR=/data/uploads
EXPORTS_DIR=/data/exports
NODE_ENV=production
```

### Step 4: Deploy

```bash
railway up
```

Wait for build to complete. First deploy creates the database via `prisma migrate deploy`.

### Step 5: Seed Production Database

After first successful deploy, seed the templates:

```bash
# Open Railway shell
railway shell

# Inside the shell:
npx tsx prisma/seed-template.ts
npx tsx prisma/seed-validation-rules.ts
exit
```

### Verify Deployment

```bash
# Check logs
railway logs

# Verify volume mounted correctly (should see /data directory)
railway shell
ls -la /data
```

### Redeployment

```bash
railway up                    # Deploy latest code
railway logs --tail           # Watch deployment logs
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `SQLITE_CANTOPEN` | Volume not mounted | Verify volume exists at `/data` |
| Build fails on `better-sqlite3` | Native module compilation | Railway handles this via nixpacks; ensure no conflicting Dockerfile |
| Data lost after redeploy | Volume not configured | Add volume, re-seed database |
| Health check fails | App slow to start | Increase `healthcheckTimeout` in railway.toml (default: 300s) |
| `ENOENT uploads` | Directory doesn't exist | App auto-creates on first upload; check UPLOAD_DIR env var |

### Access Production Database

```bash
railway shell
npx prisma studio    # Opens GUI (requires port forwarding)

# Or direct SQLite access
sqlite3 /data/csr.db ".tables"
```

### Railway Config Reference

`railway.toml`:
- Builder: nixpacks (auto-detects Node.js)
- Start: `prisma migrate deploy && npm start`
- Health check: `GET /` with 300s timeout
- Restart: On failure, max 3 retries

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

## Development Workflow

- Plan changes in `tasks/todo.md` before implementing
- Run `npm run test` and `npm run lint` before committing
- Capture lessons/gotchas in `tasks/lessons.md`
