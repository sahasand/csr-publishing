# CSR Appendix Publishing Framework - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an end-to-end web platform for publishing CSR appendices with document assembly, review workflow, and eCTD-ready output.

**Architecture:** Structure-first approach where eCTD hierarchy is defined as templates, documents slot into nodes, and the system validates/packages for submission.

**Tech Stack:** Next.js 14 (App Router), PostgreSQL, Prisma, BullMQ, Redis, pdf-lib, TanStack Query, Zustand, Tailwind CSS

---

## Phase 1: Project Foundation

### Task 1.1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `next.config.js`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

**Step 1: Create Next.js project with TypeScript and Tailwind**

```bash
cd /Users/sanman/Documents/csr-publishing/.worktrees/develop
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Select defaults when prompted. This creates the base project structure.

**Step 2: Verify project runs**

```bash
npm run dev
```

Expected: Server starts at http://localhost:3000, shows Next.js welcome page.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js 14 project with TypeScript and Tailwind"
```

---

### Task 1.2: Add Core Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install database and state management dependencies**

```bash
npm install @prisma/client @tanstack/react-query zustand
npm install -D prisma
```

**Step 2: Install PDF processing dependencies**

```bash
npm install pdf-lib bullmq ioredis uuid
npm install -D @types/uuid
```

**Step 3: Install UI dependencies**

```bash
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-context-menu @radix-ui/react-tooltip @radix-ui/react-accordion clsx tailwind-merge lucide-react
```

**Step 4: Verify installation**

```bash
npm ls @prisma/client @tanstack/react-query zustand pdf-lib bullmq
```

Expected: All packages listed with versions.

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add core dependencies (Prisma, TanStack Query, pdf-lib, BullMQ)"
```

---

### Task 1.3: Setup Prisma and Database Schema

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env`
- Create: `.env.example`

**Step 1: Initialize Prisma**

```bash
npx prisma init
```

**Step 2: Create .env.example**

```bash
cat > .env.example << 'EOF'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/csr_publishing?schema=public"
REDIS_URL="redis://localhost:6379"
UPLOAD_DIR="./uploads"
EOF
```

**Step 3: Copy to .env**

```bash
cp .env.example .env
```

**Step 4: Write the complete database schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============ STUDIES ============

model Study {
  id               String   @id @default(uuid())
  studyId          String   @unique // Protocol number
  sponsor          String
  therapeuticArea  String?
  phase            String?
  status           StudyStatus @default(ACTIVE)
  activeTemplateId String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  activeTemplate   StructureTemplate? @relation("ActiveTemplate", fields: [activeTemplateId], references: [id])
  documents        Document[]

  @@index([studyId])
  @@index([status])
}

enum StudyStatus {
  ACTIVE
  ARCHIVED
}

// ============ STRUCTURE TEMPLATES ============

model StructureTemplate {
  id        String   @id @default(uuid())
  name      String
  version   Int      @default(1)
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  nodes   StructureNode[]
  studies Study[]         @relation("ActiveTemplate")

  @@index([name])
}

model StructureNode {
  id              String   @id @default(uuid())
  templateId      String
  parentId        String?
  code            String   // e.g., "16.2.1"
  title           String
  documentType    DocumentType @default(PDF)
  required        Boolean  @default(false)
  sortOrder       Int      @default(0)
  validationRules String[] // Rule IDs
  checklistId     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  template  StructureTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  parent    StructureNode?    @relation("NodeHierarchy", fields: [parentId], references: [id])
  children  StructureNode[]   @relation("NodeHierarchy")
  documents Document[]
  checklist Checklist?        @relation(fields: [checklistId], references: [id])

  @@unique([templateId, code])
  @@index([templateId])
  @@index([parentId])
}

enum DocumentType {
  PDF
  DATASET
  LISTING
  FIGURE
  OTHER
}

// ============ DOCUMENTS ============

model Document {
  id              String   @id @default(uuid())
  studyId         String
  slotId          String   // Structure node ID
  version         Int      @default(1)

  // File references
  sourceFileName  String
  sourcePath      String
  processedPath   String?

  // Status
  status          DocumentStatus @default(DRAFT)
  processingError String?

  // Metadata
  mimeType        String?
  pageCount       Int?
  fileSize        Int      // bytes
  pdfVersion      String?
  isPdfA          Boolean  @default(false)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  study              Study               @relation(fields: [studyId], references: [id], onDelete: Cascade)
  slot               StructureNode       @relation(fields: [slotId], references: [id])
  annotations        Annotation[]
  validationResults  ValidationResult[]
  checklistResponse  ChecklistResponse?

  @@index([studyId])
  @@index([slotId])
  @@index([status])
}

enum DocumentStatus {
  DRAFT
  PROCESSING
  PROCESSED
  PROCESSING_FAILED
  IN_REVIEW
  CORRECTIONS_NEEDED
  APPROVED
  PUBLISHED
}

// ============ ANNOTATIONS ============

model Annotation {
  id          String   @id @default(uuid())
  documentId  String
  authorId    String   // For future user system
  authorName  String   @default("Reviewer")
  type        AnnotationType
  status      AnnotationStatus @default(OPEN)
  pageNumber  Int
  coordinates Json?    // { x, y, width, height }
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  resolvedAt  DateTime?

  document Document          @relation(fields: [documentId], references: [id], onDelete: Cascade)
  replies  AnnotationReply[]

  @@index([documentId])
  @@index([status])
}

model AnnotationReply {
  id           String   @id @default(uuid())
  annotationId String
  authorId     String
  authorName   String   @default("Reviewer")
  content      String
  createdAt    DateTime @default(now())

  annotation Annotation @relation(fields: [annotationId], references: [id], onDelete: Cascade)

  @@index([annotationId])
}

enum AnnotationType {
  NOTE
  QUESTION
  CORRECTION_REQUIRED
  FYI
}

enum AnnotationStatus {
  OPEN
  RESOLVED
  WONT_FIX
}

// ============ CHECKLISTS ============

model Checklist {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  items     ChecklistItem[]
  nodes     StructureNode[]
  responses ChecklistResponse[]

  @@index([name])
}

model ChecklistItem {
  id            String   @id @default(uuid())
  checklistId   String
  category      String   // e.g., "Formatting", "Pagination"
  text          String
  autoCheck     Boolean  @default(false)
  autoCheckRule String?  // Validation rule ID to auto-populate
  required      Boolean  @default(true)
  sortOrder     Int      @default(0)
  createdAt     DateTime @default(now())

  checklist Checklist @relation(fields: [checklistId], references: [id], onDelete: Cascade)

  @@index([checklistId])
}

model ChecklistResponse {
  id          String   @id @default(uuid())
  documentId  String   @unique
  checklistId String
  responses   Json     // Array of { itemId, result, notes }
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  document  Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  checklist Checklist @relation(fields: [checklistId], references: [id])

  @@index([checklistId])
}

// ============ VALIDATION ============

model ValidationRule {
  id        String   @id @default(uuid())
  name      String
  category  ValidationCategory
  checkFn   String   // Function identifier
  params    Json     @default("{}")
  severity  ValidationSeverity @default(ERROR)
  autoFix   Boolean  @default(false)
  message   String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([category])
  @@index([isActive])
}

model ValidationResult {
  id         String   @id @default(uuid())
  documentId String
  ruleId     String
  ruleName   String
  passed     Boolean
  message    String?
  details    Json?
  createdAt  DateTime @default(now())

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@index([passed])
}

enum ValidationCategory {
  PDF_COMPLIANCE
  ECTD_TECHNICAL
  FORMATTING
  CONTENT
}

enum ValidationSeverity {
  ERROR
  WARNING
  INFO
}

// ============ PROCESSING JOBS ============

model ProcessingJob {
  id         String   @id @default(uuid())
  documentId String
  jobType    JobType
  status     JobStatus @default(PENDING)
  progress   Int       @default(0)
  error      String?
  result     Json?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  startedAt  DateTime?
  completedAt DateTime?

  @@index([documentId])
  @@index([status])
}

enum JobType {
  PDF_CONVERSION
  PDF_VALIDATION
  METADATA_EXTRACTION
  PACKAGE_EXPORT
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

**Step 5: Verify schema is valid**

```bash
npx prisma validate
```

Expected: "The schema is valid!"

**Step 6: Commit**

```bash
git add prisma/schema.prisma .env.example .gitignore
git commit -m "feat: add Prisma schema with complete data model"
```

---

### Task 1.4: Setup Docker Compose for Development

**Files:**
- Create: `docker-compose.yml`

**Step 1: Create docker-compose.yml**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: csr-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: csr_publishing
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: csr-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

**Step 2: Start services**

```bash
docker compose up -d
```

**Step 3: Verify services are running**

```bash
docker compose ps
```

Expected: Both postgres and redis showing "Up" status.

**Step 4: Run database migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration created and applied successfully.

**Step 5: Generate Prisma client**

```bash
npx prisma generate
```

**Step 6: Commit**

```bash
git add docker-compose.yml prisma/migrations
git commit -m "feat: add Docker Compose for Postgres and Redis"
```

---

### Task 1.5: Create Database Client and Utilities

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/utils.ts`

**Step 1: Create Prisma client singleton**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
```

**Step 2: Create utility functions**

Create `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

**Step 3: Verify imports work**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/lib/db.ts src/lib/utils.ts
git commit -m "feat: add database client singleton and utility functions"
```

---

## Phase 2: Core API Routes

### Task 2.1: Studies API

**Files:**
- Create: `src/app/api/studies/route.ts`
- Create: `src/app/api/studies/[id]/route.ts`
- Create: `src/types/index.ts`

**Step 1: Create shared types**

Create `src/types/index.ts`:

```typescript
import type {
  Study,
  StructureTemplate,
  StructureNode,
  Document,
  Annotation,
  Checklist,
  ChecklistItem,
  ValidationRule,
  ValidationResult,
} from '@prisma/client';

// Re-export Prisma types
export type {
  Study,
  StructureTemplate,
  StructureNode,
  Document,
  Annotation,
  Checklist,
  ChecklistItem,
  ValidationRule,
  ValidationResult,
};

// API request/response types
export interface CreateStudyInput {
  studyId: string;
  sponsor: string;
  therapeuticArea?: string;
  phase?: string;
}

export interface UpdateStudyInput {
  sponsor?: string;
  therapeuticArea?: string;
  phase?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  activeTemplateId?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Tree node with children for UI
export interface StructureNodeWithChildren extends StructureNode {
  children: StructureNodeWithChildren[];
  documentCount?: number;
}

// Study with related data
export interface StudyWithTemplate extends Study {
  activeTemplate: StructureTemplate | null;
  _count?: {
    documents: number;
  };
}
```

**Step 2: Create studies list/create endpoint**

Create `src/app/api/studies/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateStudyInput } from '@/types';

export async function GET() {
  try {
    const studies = await db.study.findMany({
      include: {
        activeTemplate: true,
        _count: {
          select: { documents: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ data: studies });
  } catch (error) {
    console.error('Failed to fetch studies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch studies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateStudyInput = await request.json();

    if (!body.studyId || !body.sponsor) {
      return NextResponse.json(
        { error: 'studyId and sponsor are required' },
        { status: 400 }
      );
    }

    const existing = await db.study.findUnique({
      where: { studyId: body.studyId },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Study with this ID already exists' },
        { status: 409 }
      );
    }

    const study = await db.study.create({
      data: {
        studyId: body.studyId,
        sponsor: body.sponsor,
        therapeuticArea: body.therapeuticArea,
        phase: body.phase,
      },
    });

    return NextResponse.json({ data: study }, { status: 201 });
  } catch (error) {
    console.error('Failed to create study:', error);
    return NextResponse.json(
      { error: 'Failed to create study' },
      { status: 500 }
    );
  }
}
```

**Step 3: Create single study endpoint**

Create `src/app/api/studies/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateStudyInput } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const study = await db.study.findUnique({
      where: { id },
      include: {
        activeTemplate: {
          include: {
            nodes: {
              orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
            },
          },
        },
        _count: {
          select: { documents: true },
        },
      },
    });

    if (!study) {
      return NextResponse.json({ error: 'Study not found' }, { status: 404 });
    }

    return NextResponse.json({ data: study });
  } catch (error) {
    console.error('Failed to fetch study:', error);
    return NextResponse.json(
      { error: 'Failed to fetch study' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateStudyInput = await request.json();

    const study = await db.study.update({
      where: { id },
      data: body,
      include: {
        activeTemplate: true,
      },
    });

    return NextResponse.json({ data: study });
  } catch (error) {
    console.error('Failed to update study:', error);
    return NextResponse.json(
      { error: 'Failed to update study' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.study.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Failed to delete study:', error);
    return NextResponse.json(
      { error: 'Failed to delete study' },
      { status: 500 }
    );
  }
}
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 5: Commit**

```bash
git add src/types/index.ts src/app/api/studies/
git commit -m "feat: add Studies API endpoints (CRUD)"
```

---

### Task 2.2: Structure Templates API

**Files:**
- Create: `src/app/api/templates/route.ts`
- Create: `src/app/api/templates/[id]/route.ts`
- Create: `src/app/api/templates/[id]/nodes/route.ts`

**Step 1: Add template types to types file**

Append to `src/types/index.ts`:

```typescript
export interface CreateTemplateInput {
  name: string;
  isDefault?: boolean;
}

export interface CreateNodeInput {
  parentId?: string | null;
  code: string;
  title: string;
  documentType?: 'PDF' | 'DATASET' | 'LISTING' | 'FIGURE' | 'OTHER';
  required?: boolean;
  sortOrder?: number;
  validationRules?: string[];
  checklistId?: string | null;
}

export interface UpdateNodeInput {
  code?: string;
  title?: string;
  documentType?: 'PDF' | 'DATASET' | 'LISTING' | 'FIGURE' | 'OTHER';
  required?: boolean;
  sortOrder?: number;
  validationRules?: string[];
  checklistId?: string | null;
}
```

**Step 2: Create templates list/create endpoint**

Create `src/app/api/templates/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateTemplateInput } from '@/types';

export async function GET() {
  try {
    const templates = await db.structureTemplate.findMany({
      include: {
        _count: {
          select: { nodes: true, studies: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateTemplateInput = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    const template = await db.structureTemplate.create({
      data: {
        name: body.name,
        isDefault: body.isDefault ?? false,
      },
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    console.error('Failed to create template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
```

**Step 3: Create single template endpoint**

Create `src/app/api/templates/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await db.structureTemplate.findUnique({
      where: { id },
      include: {
        nodes: {
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error('Failed to fetch template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const template = await db.structureTemplate.update({
      where: { id },
      data: {
        name: body.name,
        isDefault: body.isDefault,
      },
    });

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error('Failed to update template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if template is in use
    const studyCount = await db.study.count({
      where: { activeTemplateId: id },
    });

    if (studyCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete template that is in use by studies' },
        { status: 400 }
      );
    }

    await db.structureTemplate.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Failed to delete template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
```

**Step 4: Create nodes endpoint for a template**

Create `src/app/api/templates/[id]/nodes/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateNodeInput } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const nodes = await db.structureNode.findMany({
      where: { templateId: id },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    return NextResponse.json({ data: nodes });
  } catch (error) {
    console.error('Failed to fetch nodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const body: CreateNodeInput = await request.json();

    if (!body.code || !body.title) {
      return NextResponse.json(
        { error: 'code and title are required' },
        { status: 400 }
      );
    }

    // Check template exists
    const template = await db.structureTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const node = await db.structureNode.create({
      data: {
        templateId,
        parentId: body.parentId ?? null,
        code: body.code,
        title: body.title,
        documentType: body.documentType ?? 'PDF',
        required: body.required ?? false,
        sortOrder: body.sortOrder ?? 0,
        validationRules: body.validationRules ?? [],
        checklistId: body.checklistId ?? null,
      },
    });

    return NextResponse.json({ data: node }, { status: 201 });
  } catch (error) {
    console.error('Failed to create node:', error);
    return NextResponse.json(
      { error: 'Failed to create node' },
      { status: 500 }
    );
  }
}
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 6: Commit**

```bash
git add src/types/index.ts src/app/api/templates/
git commit -m "feat: add Structure Templates API endpoints"
```

---

### Task 2.3: Documents API

**Files:**
- Create: `src/app/api/documents/route.ts`
- Create: `src/app/api/documents/[id]/route.ts`
- Create: `src/app/api/studies/[id]/documents/route.ts`

**Step 1: Add document types**

Append to `src/types/index.ts`:

```typescript
export interface CreateDocumentInput {
  studyId: string;
  slotId: string;
  sourceFileName: string;
  sourcePath: string;
  mimeType?: string;
  fileSize: number;
}

export interface UpdateDocumentInput {
  status?: 'DRAFT' | 'PROCESSING' | 'PROCESSED' | 'PROCESSING_FAILED' | 'IN_REVIEW' | 'CORRECTIONS_NEEDED' | 'APPROVED' | 'PUBLISHED';
  processedPath?: string;
  processingError?: string;
  pageCount?: number;
  pdfVersion?: string;
  isPdfA?: boolean;
}

export interface DocumentWithRelations extends Document {
  slot: StructureNode;
  _count?: {
    annotations: number;
    validationResults: number;
  };
}
```

**Step 2: Create documents list endpoint**

Create `src/app/api/documents/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studyId = searchParams.get('studyId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (studyId) where.studyId = studyId;
    if (status) where.status = status;

    const documents = await db.document.findMany({
      where,
      include: {
        slot: true,
        _count: {
          select: {
            annotations: true,
            validationResults: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ data: documents });
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
```

**Step 3: Create single document endpoint**

Create `src/app/api/documents/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateDocumentInput } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = await db.document.findUnique({
      where: { id },
      include: {
        slot: true,
        study: true,
        annotations: {
          include: { replies: true },
          orderBy: { createdAt: 'desc' },
        },
        validationResults: {
          orderBy: { createdAt: 'desc' },
        },
        checklistResponse: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: document });
  } catch (error) {
    console.error('Failed to fetch document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateDocumentInput = await request.json();

    const document = await db.document.update({
      where: { id },
      data: body,
      include: { slot: true },
    });

    return NextResponse.json({ data: document });
  } catch (error) {
    console.error('Failed to update document:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.document.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Failed to delete document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
```

**Step 4: Create study documents endpoint**

Create `src/app/api/studies/[id]/documents/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateDocumentInput } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documents = await db.document.findMany({
      where: { studyId: id },
      include: {
        slot: true,
        _count: {
          select: {
            annotations: true,
            validationResults: true,
          },
        },
      },
      orderBy: [{ slot: { sortOrder: 'asc' } }, { version: 'desc' }],
    });

    return NextResponse.json({ data: documents });
  } catch (error) {
    console.error('Failed to fetch study documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;
    const body: Omit<CreateDocumentInput, 'studyId'> = await request.json();

    // Verify study exists
    const study = await db.study.findUnique({ where: { id: studyId } });
    if (!study) {
      return NextResponse.json({ error: 'Study not found' }, { status: 404 });
    }

    // Verify slot exists
    const slot = await db.structureNode.findUnique({
      where: { id: body.slotId },
    });
    if (!slot) {
      return NextResponse.json(
        { error: 'Structure node not found' },
        { status: 404 }
      );
    }

    // Get next version number for this slot
    const existingDocs = await db.document.count({
      where: { studyId, slotId: body.slotId },
    });

    const document = await db.document.create({
      data: {
        studyId,
        slotId: body.slotId,
        version: existingDocs + 1,
        sourceFileName: body.sourceFileName,
        sourcePath: body.sourcePath,
        mimeType: body.mimeType,
        fileSize: body.fileSize,
        status: 'DRAFT',
      },
      include: { slot: true },
    });

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error) {
    console.error('Failed to create document:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
}
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 6: Commit**

```bash
git add src/types/index.ts src/app/api/documents/ src/app/api/studies/
git commit -m "feat: add Documents API endpoints"
```

---

### Task 2.4: File Upload API

**Files:**
- Create: `src/app/api/upload/route.ts`
- Create: `src/lib/storage.ts`

**Step 1: Create storage utility**

Create `src/lib/storage.ts`:

```typescript
import { writeFile, mkdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export async function ensureUploadDir(): Promise<void> {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await mkdir(join(UPLOAD_DIR, 'source'), { recursive: true });
    await mkdir(join(UPLOAD_DIR, 'processed'), { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

export async function saveFile(
  file: File,
  subdir: 'source' | 'processed' = 'source'
): Promise<{ path: string; size: number }> {
  await ensureUploadDir();

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = file.name.split('.').pop() || 'bin';
  const filename = `${uuid()}.${ext}`;
  const relativePath = join(subdir, filename);
  const fullPath = join(UPLOAD_DIR, relativePath);

  await writeFile(fullPath, buffer);

  return {
    path: relativePath,
    size: buffer.length,
  };
}

export async function deleteFile(relativePath: string): Promise<void> {
  const fullPath = join(UPLOAD_DIR, relativePath);
  try {
    await unlink(fullPath);
  } catch (error) {
    // File doesn't exist, ignore
  }
}

export async function getFileStats(relativePath: string): Promise<{
  size: number;
  exists: boolean;
}> {
  const fullPath = join(UPLOAD_DIR, relativePath);
  try {
    const stats = await stat(fullPath);
    return { size: stats.size, exists: true };
  } catch {
    return { size: 0, exists: false };
  }
}

export function getFullPath(relativePath: string): string {
  return join(UPLOAD_DIR, relativePath);
}
```

**Step 2: Create upload endpoint**

Create `src/app/api/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { saveFile } from '@/lib/storage';
import { db } from '@/lib/db';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/rtf',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const studyId = formData.get('studyId') as string | null;
    const slotId = formData.get('slotId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!studyId || !slotId) {
      return NextResponse.json(
        { error: 'studyId and slotId are required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.xpt')) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds maximum size of 100MB' },
        { status: 400 }
      );
    }

    // Verify study and slot exist
    const study = await db.study.findUnique({ where: { id: studyId } });
    if (!study) {
      return NextResponse.json({ error: 'Study not found' }, { status: 404 });
    }

    const slot = await db.structureNode.findUnique({ where: { id: slotId } });
    if (!slot) {
      return NextResponse.json(
        { error: 'Structure node not found' },
        { status: 404 }
      );
    }

    // Save file
    const { path, size } = await saveFile(file);

    // Get next version
    const existingCount = await db.document.count({
      where: { studyId, slotId },
    });

    // Create document record
    const document = await db.document.create({
      data: {
        studyId,
        slotId,
        version: existingCount + 1,
        sourceFileName: file.name,
        sourcePath: path,
        mimeType: file.type,
        fileSize: size,
        status: 'DRAFT',
      },
      include: { slot: true },
    });

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

**Step 3: Add uploads to .gitignore**

Append to `.gitignore`:

```
# Uploads
uploads/
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 5: Commit**

```bash
git add src/lib/storage.ts src/app/api/upload/route.ts .gitignore
git commit -m "feat: add file upload API with local storage"
```

---

## Phase 3: UI Foundation

### Task 3.1: Setup TanStack Query Provider

**Files:**
- Create: `src/components/providers/query-provider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create query provider**

Create `src/components/providers/query-provider.tsx`:

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

**Step 2: Update root layout**

Replace `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CSR Publishing',
  description: 'Clinical Study Report Appendix Publishing Framework',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

**Step 3: Verify app still runs**

```bash
npm run dev
```

Expected: App starts without errors.

**Step 4: Commit**

```bash
git add src/components/providers/query-provider.tsx src/app/layout.tsx
git commit -m "feat: add TanStack Query provider"
```

---

### Task 3.2: Create Base UI Components

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/badge.tsx`

**Step 1: Create Button component**

Create `src/components/ui/button.tsx`:

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-gray-900 text-gray-50 shadow hover:bg-gray-900/90':
              variant === 'default',
            'bg-red-500 text-gray-50 shadow-sm hover:bg-red-500/90':
              variant === 'destructive',
            'border border-gray-200 bg-white shadow-sm hover:bg-gray-100 hover:text-gray-900':
              variant === 'outline',
            'hover:bg-gray-100 hover:text-gray-900': variant === 'ghost',
            'text-gray-900 underline-offset-4 hover:underline':
              variant === 'link',
          },
          {
            'h-9 px-4 py-2': size === 'default',
            'h-8 rounded-md px-3 text-xs': size === 'sm',
            'h-10 rounded-md px-8': size === 'lg',
            'h-9 w-9': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
```

**Step 2: Create Card component**

Create `src/components/ui/card.tsx`:

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-xl border border-gray-200 bg-white text-gray-950 shadow',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-gray-500', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
```

**Step 3: Create Input component**

Create `src/components/ui/input.tsx`:

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
```

**Step 4: Create Badge component**

Create `src/components/ui/badge.tsx`:

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2',
        {
          'border-transparent bg-gray-900 text-gray-50': variant === 'default',
          'border-transparent bg-gray-100 text-gray-900': variant === 'secondary',
          'border-transparent bg-red-500 text-gray-50': variant === 'destructive',
          'text-gray-950': variant === 'outline',
          'border-transparent bg-green-500 text-white': variant === 'success',
          'border-transparent bg-yellow-500 text-white': variant === 'warning',
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 6: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add base UI components (Button, Card, Input, Badge)"
```

---

## Phase 4: Studies Management UI

### Task 4.1: Studies List Page

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/page.tsx`
- Create: `src/app/(dashboard)/studies/page.tsx`
- Create: `src/components/studies/study-list.tsx`
- Create: `src/hooks/use-studies.ts`

**Step 1: Create API hooks**

Create `src/hooks/use-studies.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudyWithTemplate, CreateStudyInput, UpdateStudyInput } from '@/types';

async function fetchStudies(): Promise<StudyWithTemplate[]> {
  const res = await fetch('/api/studies');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function fetchStudy(id: string): Promise<StudyWithTemplate> {
  const res = await fetch(`/api/studies/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function createStudy(data: CreateStudyInput): Promise<StudyWithTemplate> {
  const res = await fetch('/api/studies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function updateStudy({
  id,
  data,
}: {
  id: string;
  data: UpdateStudyInput;
}): Promise<StudyWithTemplate> {
  const res = await fetch(`/api/studies/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function deleteStudy(id: string): Promise<void> {
  const res = await fetch(`/api/studies/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error);
  }
}

export function useStudies() {
  return useQuery({
    queryKey: ['studies'],
    queryFn: fetchStudies,
  });
}

export function useStudy(id: string) {
  return useQuery({
    queryKey: ['studies', id],
    queryFn: () => fetchStudy(id),
    enabled: !!id,
  });
}

export function useCreateStudy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createStudy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studies'] });
    },
  });
}

export function useUpdateStudy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateStudy,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      queryClient.invalidateQueries({ queryKey: ['studies', data.id] });
    },
  });
}

export function useDeleteStudy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteStudy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studies'] });
    },
  });
}
```

**Step 2: Create dashboard layout**

Create `src/app/(dashboard)/layout.tsx`:

```typescript
import Link from 'next/link';
import { FileText, FolderTree, Settings, LayoutDashboard } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-gray-50">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900">CSR Publishing</h1>
        </div>
        <nav className="px-4 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/studies"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <FileText className="h-4 w-4" />
            Studies
          </Link>
          <Link
            href="/templates"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <FolderTree className="h-4 w-4" />
            Templates
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-white">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
```

**Step 3: Create dashboard home page**

Create `src/app/(dashboard)/page.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, FolderTree, CheckCircle, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Active Studies
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Templates
            </CardTitle>
            <FolderTree className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Documents Approved
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Pending Review
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Step 4: Create study list component**

Create `src/components/studies/study-list.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { useStudies, useDeleteStudy } from '@/hooks/use-studies';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { Trash2, ExternalLink, Loader2 } from 'lucide-react';

export function StudyList() {
  const { data: studies, isLoading, error } = useStudies();
  const deleteStudy = useDeleteStudy();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        Failed to load studies: {error.message}
      </div>
    );
  }

  if (!studies?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          No studies found. Create your first study to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {studies.map((study) => (
        <Card key={study.id}>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-lg">{study.studyId}</CardTitle>
              <CardDescription>
                {study.sponsor}
                {study.therapeuticArea && ` · ${study.therapeuticArea}`}
                {study.phase && ` · ${study.phase}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={study.status === 'ACTIVE' ? 'success' : 'secondary'}
              >
                {study.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                <span>{study._count?.documents || 0} documents</span>
                <span className="mx-2">·</span>
                <span>Updated {formatDate(study.updatedAt)}</span>
                {study.activeTemplate && (
                  <>
                    <span className="mx-2">·</span>
                    <span>Template: {study.activeTemplate.name}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/studies/${study.id}`}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm('Delete this study?')) {
                      deleteStudy.mutate(study.id);
                    }
                  }}
                  disabled={deleteStudy.isPending}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 5: Create studies page**

Create `src/app/(dashboard)/studies/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { StudyList } from '@/components/studies/study-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateStudy } from '@/hooks/use-studies';
import { Plus, X } from 'lucide-react';

export default function StudiesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [studyId, setStudyId] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [therapeuticArea, setTherapeuticArea] = useState('');
  const [phase, setPhase] = useState('');

  const createStudy = useCreateStudy();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createStudy.mutateAsync({
      studyId,
      sponsor,
      therapeuticArea: therapeuticArea || undefined,
      phase: phase || undefined,
    });
    setShowCreate(false);
    setStudyId('');
    setSponsor('');
    setTherapeuticArea('');
    setPhase('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Studies</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Study
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Create New Study</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCreate(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Study ID (Protocol Number) *
                  </label>
                  <Input
                    value={studyId}
                    onChange={(e) => setStudyId(e.target.value)}
                    placeholder="e.g., ABC-123-001"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Sponsor *
                  </label>
                  <Input
                    value={sponsor}
                    onChange={(e) => setSponsor(e.target.value)}
                    placeholder="e.g., Acme Pharma"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Therapeutic Area
                  </label>
                  <Input
                    value={therapeuticArea}
                    onChange={(e) => setTherapeuticArea(e.target.value)}
                    placeholder="e.g., Oncology"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Phase
                  </label>
                  <Input
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                    placeholder="e.g., Phase 3"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createStudy.isPending}>
                  {createStudy.isPending ? 'Creating...' : 'Create Study'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <StudyList />
    </div>
  );
}
```

**Step 6: Delete default page.tsx if needed**

Remove the original `src/app/page.tsx` if it exists and conflicts.

**Step 7: Verify app runs**

```bash
npm run dev
```

Expected: Navigate to http://localhost:3000/studies and see the studies page.

**Step 8: Commit**

```bash
git add src/app/\(dashboard\)/ src/components/studies/ src/hooks/use-studies.ts
git commit -m "feat: add Studies management UI (list, create)"
```

---

## Checkpoint: Phase 1-4 Complete

At this point you have:
- Next.js project with TypeScript and Tailwind
- PostgreSQL database with full schema
- API routes for Studies, Templates, Documents
- File upload infrastructure
- Studies list and create UI

**Verify everything works:**

```bash
# Make sure Docker services are running
docker compose ps

# Run the app
npm run dev

# In another terminal, test the API
curl http://localhost:3000/api/studies
```

Expected: `{"data":[]}` (empty array)

---

## Remaining Phases (Summary)

The following phases continue the implementation:

### Phase 5: Structure Template Management UI
- Template list page
- Template editor with tree view
- Node CRUD operations
- Drag-and-drop reordering

### Phase 6: Study Workspace UI
- Three-panel layout (tree, workspace, sidebar)
- Document upload to nodes
- Document list per node
- Status indicators

### Phase 7: Document Processing Pipeline
- BullMQ worker setup
- PDF validation jobs
- Metadata extraction
- Status updates via polling/SSE

### Phase 8: PDF Viewer & Annotations
- PDF.js integration
- Annotation overlay system
- Comment threads
- Status management

### Phase 9: Checklist System
- Checklist CRUD
- Checklist assignment to nodes
- Response recording
- Auto-check from validation

### Phase 10: Validation Engine
- Rule configuration
- Validation execution
- Results aggregation
- Validation report UI

### Phase 11: eCTD Packaging
- Package assembly logic
- Bookmark generation
- Hyperlink resolution
- Export ZIP generation

### Phase 12: Polish & Testing
- Error handling improvements
- Loading states
- E2E tests
- Documentation

---

**Continue to Phase 5?** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to implement task by task.
