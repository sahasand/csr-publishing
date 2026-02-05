/**
 * Job type definitions for document processing pipeline
 */

export type JobType = 'PDF_VALIDATION' | 'METADATA_EXTRACTION' | 'PDF_CONVERSION';

/**
 * Data passed to document processing jobs
 */
export interface DocumentJobData {
  documentId: string;
  filePath: string;
  jobType: JobType;
}

/**
 * Result returned from job processing
 */
export interface JobResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

/**
 * PDF validation specific result data
 */
export interface PDFValidationResultData {
  isValid: boolean;
  pageCount?: number;
  pdfVersion?: string;
  isPdfA?: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Metadata extraction specific result data
 */
export interface MetadataExtractionResultData {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creationDate?: string;
  modificationDate?: string;
  producer?: string;
  creator?: string;
}

/**
 * PDF conversion specific result data
 */
export interface PDFConversionResultData {
  outputPath: string;
  convertedAt: string;
  conversionType: string;
}

/**
 * Job status for tracking
 */
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

/**
 * Job progress information
 */
export interface JobProgress {
  jobId: string;
  documentId: string;
  jobType: JobType;
  status: JobStatus;
  progress?: number;
  result?: JobResult;
  failedReason?: string;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
}
