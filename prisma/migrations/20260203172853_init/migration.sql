-- CreateTable
CREATE TABLE "Study" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT NOT NULL,
    "sponsor" TEXT NOT NULL,
    "therapeuticArea" TEXT,
    "phase" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activeTemplateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Study_activeTemplateId_fkey" FOREIGN KEY ("activeTemplateId") REFERENCES "StructureTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StructureTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StructureNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'PDF',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "validationRules" TEXT NOT NULL DEFAULT '[]',
    "checklistId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StructureNode_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StructureTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StructureNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StructureNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StructureNode_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceFileName" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "processedPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "processingError" TEXT,
    "mimeType" TEXT,
    "pageCount" INTEGER,
    "fileSize" INTEGER NOT NULL,
    "pdfVersion" TEXT,
    "isPdfA" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "StructureNode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL DEFAULT 'Reviewer',
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "pageNumber" INTEGER NOT NULL,
    "coordinates" JSONB,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    CONSTRAINT "Annotation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnnotationReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "annotationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL DEFAULT 'Reviewer',
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnotationReply_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "Annotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checklistId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "autoCheck" BOOLEAN NOT NULL DEFAULT false,
    "autoCheckRule" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistResponse_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistResponse_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "checkFn" TEXT NOT NULL,
    "params" TEXT NOT NULL DEFAULT '{}',
    "severity" TEXT NOT NULL DEFAULT 'ERROR',
    "autoFix" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ValidationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "message" TEXT,
    "details" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "result" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "ProcessingJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Study_studyId_key" ON "Study"("studyId");

-- CreateIndex
CREATE INDEX "Study_studyId_idx" ON "Study"("studyId");

-- CreateIndex
CREATE INDEX "Study_status_idx" ON "Study"("status");

-- CreateIndex
CREATE INDEX "StructureTemplate_name_idx" ON "StructureTemplate"("name");

-- CreateIndex
CREATE INDEX "StructureNode_templateId_idx" ON "StructureNode"("templateId");

-- CreateIndex
CREATE INDEX "StructureNode_parentId_idx" ON "StructureNode"("parentId");

-- CreateIndex
CREATE INDEX "StructureNode_code_idx" ON "StructureNode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StructureNode_templateId_code_key" ON "StructureNode"("templateId", "code");

-- CreateIndex
CREATE INDEX "Document_studyId_idx" ON "Document"("studyId");

-- CreateIndex
CREATE INDEX "Document_slotId_idx" ON "Document"("slotId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_sourceFileName_idx" ON "Document"("sourceFileName");

-- CreateIndex
CREATE UNIQUE INDEX "Document_studyId_slotId_version_key" ON "Document"("studyId", "slotId", "version");

-- CreateIndex
CREATE INDEX "Annotation_documentId_idx" ON "Annotation"("documentId");

-- CreateIndex
CREATE INDEX "Annotation_status_idx" ON "Annotation"("status");

-- CreateIndex
CREATE INDEX "AnnotationReply_annotationId_idx" ON "AnnotationReply"("annotationId");

-- CreateIndex
CREATE INDEX "Checklist_name_idx" ON "Checklist"("name");

-- CreateIndex
CREATE INDEX "ChecklistItem_checklistId_idx" ON "ChecklistItem"("checklistId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistResponse_documentId_key" ON "ChecklistResponse"("documentId");

-- CreateIndex
CREATE INDEX "ChecklistResponse_checklistId_idx" ON "ChecklistResponse"("checklistId");

-- CreateIndex
CREATE INDEX "ValidationRule_category_idx" ON "ValidationRule"("category");

-- CreateIndex
CREATE INDEX "ValidationRule_isActive_idx" ON "ValidationRule"("isActive");

-- CreateIndex
CREATE INDEX "ValidationResult_documentId_idx" ON "ValidationResult"("documentId");

-- CreateIndex
CREATE INDEX "ValidationResult_passed_idx" ON "ValidationResult"("passed");

-- CreateIndex
CREATE INDEX "ProcessingJob_documentId_idx" ON "ProcessingJob"("documentId");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_idx" ON "ProcessingJob"("status");
