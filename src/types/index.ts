import type {
  Study,
  StructureTemplate,
  StructureNode,
  Document,
  Annotation,
  AnnotationReply,
  Checklist,
  ChecklistItem,
  ChecklistResponse,
  ValidationRule,
  ValidationResult,
} from '@/generated/prisma/client';

// Re-export Prisma types
export type {
  Study,
  StructureTemplate,
  StructureNode,
  Document,
  Annotation,
  AnnotationReply,
  Checklist,
  ChecklistItem,
  ChecklistResponse,
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

// Template with nodes for study workspace
export interface TemplateWithNodes extends StructureTemplate {
  nodes: StructureNode[];
}

// Study with related data
export interface StudyWithTemplate extends Study {
  activeTemplate: TemplateWithNodes | null;
  _count?: {
    documents: number;
  };
}

// Template API types
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

// Reorder API types
export interface ReorderItem {
  id: string;
  sortOrder: number;
  parentId?: string | null;
}

export interface ReorderNodesInput {
  templateId: string;
  updates: ReorderItem[];
}

// Document API types
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

// Processing job types
export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type JobType = 'PDF_VALIDATION' | 'METADATA_EXTRACTION' | 'PACKAGE_EXPORT';

export interface LatestProcessingJob {
  id: string;
  jobType: JobType;
  status: JobStatus;
  progress: number;
  error: string | null;
  createdAt: Date | string;
  completedAt: Date | string | null;
}

export interface DocumentWithRelations extends Document {
  slot: StructureNode;
  _count?: {
    annotations: number;
    validationResults: number;
  };
  latestProcessingJob?: LatestProcessingJob | null;
}

// Annotation API types
export type AnnotationType = 'NOTE' | 'QUESTION' | 'CORRECTION_REQUIRED' | 'FYI';
export type AnnotationStatus = 'OPEN' | 'RESOLVED' | 'WONT_FIX';

export interface AnnotationCoordinates {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface CreateAnnotationInput {
  type: AnnotationType;
  pageNumber: number;
  content: string;
  coordinates?: AnnotationCoordinates;
  authorId?: string;
  authorName?: string;
}

export interface UpdateAnnotationInput {
  content?: string;
  status?: AnnotationStatus;
  type?: AnnotationType;
}

export interface CreateAnnotationReplyInput {
  content: string;
  authorId?: string;
  authorName?: string;
}

export interface AnnotationWithReplies extends Annotation {
  replies: AnnotationReply[];
}

// Checklist API types
export interface CreateChecklistInput {
  name: string;
}

export interface UpdateChecklistInput {
  name?: string;
}

export interface CreateChecklistItemInput {
  category: string;
  text: string;
  autoCheck?: boolean;
  autoCheckRule?: string | null;
  required?: boolean;
  sortOrder?: number;
}

export interface UpdateChecklistItemInput {
  category?: string;
  text?: string;
  autoCheck?: boolean;
  autoCheckRule?: string | null;
  required?: boolean;
  sortOrder?: number;
}

export interface ChecklistWithItems extends Checklist {
  items: ChecklistItem[];
}

export interface ChecklistWithCount extends Checklist {
  _count: {
    items: number;
  };
}

// Checklist Response API types
export type ChecklistItemResult = 'pass' | 'fail' | 'na';

export interface ChecklistItemResponse {
  itemId: string;
  result: ChecklistItemResult | null;
  notes?: string;
}

export interface CreateChecklistResponseInput {
  checklistId: string;
}

export interface UpdateChecklistResponseInput {
  responses: Array<{
    itemId: string;
    result: ChecklistItemResult;
    notes?: string;
  }>;
}

export interface ChecklistResponseWithChecklist extends ChecklistResponse {
  checklist: ChecklistWithItems;
}

// Validation Rule API types
export type ValidationCategoryType = 'PDF_COMPLIANCE' | 'ECTD_TECHNICAL' | 'FORMATTING' | 'CONTENT';
export type ValidationSeverityType = 'ERROR' | 'WARNING' | 'INFO';

export interface CreateValidationRuleInput {
  name: string;
  category: ValidationCategoryType;
  checkFn: string;
  message: string;
  params?: Record<string, unknown>;
  severity?: ValidationSeverityType;
  autoFix?: boolean;
  isActive?: boolean;
}

export interface UpdateValidationRuleInput {
  name?: string;
  category?: ValidationCategoryType;
  checkFn?: string;
  message?: string;
  params?: Record<string, unknown>;
  severity?: ValidationSeverityType;
  autoFix?: boolean;
  isActive?: boolean;
}

// Validation Result API types

/**
 * ValidationResult with additional rule metadata (severity, category)
 * Returned by GET /api/documents/[id]/validation
 */
export interface ValidationResultWithDetails extends ValidationResult {
  severity: ValidationSeverityType;
  category: ValidationCategoryType;
}

/**
 * Document validation response from GET /api/documents/[id]/validation
 */
export interface DocumentValidationResponse {
  documentId: string;
  passed: number;
  failed: number;
  errors: number;
  warnings: number;
  total: number;
  results: ValidationResultWithDetails[];
}

/**
 * Per-document validation summary for study-level aggregation
 */
export interface DocumentValidationSummary {
  documentId: string;
  documentName: string;
  slotCode: string;
  slotTitle: string;
  passed: number;
  failed: number;
  errors: number;
  warnings: number;
  total: number;
  hasErrors: boolean;
  hasWarnings: boolean;
}

/**
 * Study-level validation summary statistics
 */
export interface StudyValidationSummaryStats {
  totalDocuments: number;
  validatedDocuments: number;
  validDocuments: number;
  documentsWithErrors: number;
  documentsWithWarnings: number;
}

/**
 * Study validation response from GET /api/studies/[id]/validation
 */
export interface StudyValidationResponse {
  studyId: string;
  summary: StudyValidationSummaryStats;
  documents: DocumentValidationSummary[];
}

// Document Workflow Types
export type DocumentStatusType =
  | 'DRAFT'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'PROCESSING_FAILED'
  | 'IN_REVIEW'
  | 'CORRECTIONS_NEEDED'
  | 'APPROVED'
  | 'PUBLISHED';

export interface DocumentStatusHistory {
  id: string;
  documentId: string;
  fromStatus: DocumentStatusType;
  toStatus: DocumentStatusType;
  userId: string | null;
  userName: string;
  comment: string | null;
  createdAt: Date | string;
}

export interface TransitionDocumentInput {
  comment?: string;
  userName?: string;
}

export interface DocumentWithHistory extends Document {
  statusHistory?: DocumentStatusHistory[];
}

// Valid workflow transitions
export const WORKFLOW_TRANSITIONS: Record<DocumentStatusType, DocumentStatusType[]> = {
  DRAFT: ['IN_REVIEW'],
  PROCESSING: [],
  PROCESSED: ['IN_REVIEW'],
  PROCESSING_FAILED: ['DRAFT'],
  IN_REVIEW: ['APPROVED', 'CORRECTIONS_NEEDED'],
  CORRECTIONS_NEEDED: ['DRAFT', 'IN_REVIEW'],
  APPROVED: ['PUBLISHED', 'CORRECTIONS_NEEDED'],
  PUBLISHED: ['CORRECTIONS_NEEDED'],
};

// Status display metadata
export const STATUS_CONFIG: Record<DocumentStatusType, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  PROCESSING: { label: 'Processing', variant: 'info' },
  PROCESSED: { label: 'Processed', variant: 'info' },
  PROCESSING_FAILED: { label: 'Failed', variant: 'destructive' },
  IN_REVIEW: { label: 'In Review', variant: 'warning' },
  CORRECTIONS_NEEDED: { label: 'Corrections Needed', variant: 'destructive' },
  APPROVED: { label: 'Approved', variant: 'success' },
  PUBLISHED: { label: 'Published', variant: 'default' },
};
