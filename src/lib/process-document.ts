/**
 * Direct Document Processing Module
 *
 * Handles synchronous document processing without a job queue.
 * Processing happens in-request during upload (metadata extraction ~1-2 sec).
 */

import { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { validatePDF } from './jobs/pdf-validation';
import { extractMetadata } from './jobs/metadata-extraction';
import type { JobType, JobResult } from '@/types/jobs';

/**
 * Process a document synchronously
 *
 * @param documentId - The document ID in the database
 * @param filePath - Path to the document file
 * @param jobType - Type of processing to perform
 * @returns Processing result
 */
export async function processDocument(
  documentId: string,
  filePath: string,
  jobType: JobType
): Promise<JobResult> {
  console.log(`[Process] Starting ${jobType} for document ${documentId}`);
  const startTime = Date.now();

  try {
    let result: JobResult;

    switch (jobType) {
      case 'METADATA_EXTRACTION': {
        const metadata = await extractMetadata(documentId, filePath);
        result = {
          success: true,
          data: { documentId, ...metadata },
        };
        break;
      }

      case 'PDF_VALIDATION': {
        const validation = await validatePDF(documentId, filePath);
        result = {
          success: validation.isValid,
          data: { documentId, ...validation },
          error: validation.errors?.join('; '),
        };
        break;
      }

      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[Process] ${jobType} completed in ${duration}ms`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[Process] ${jobType} failed after ${duration}ms:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
      data: { documentId },
    };
  }
}

/**
 * Process a document and update the ProcessingJob record
 *
 * @param processingJobId - The ProcessingJob record ID
 * @param documentId - The document ID
 * @param filePath - Path to the document file
 * @param jobType - Type of processing to perform
 * @returns Processing result
 */
export async function processDocumentWithTracking(
  processingJobId: string,
  documentId: string,
  filePath: string,
  jobType: JobType
): Promise<JobResult> {
  // Mark job as running
  await db.processingJob.update({
    where: { id: processingJobId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  const result = await processDocument(documentId, filePath, jobType);

  // Update job with result
  await db.processingJob.update({
    where: { id: processingJobId },
    data: {
      status: result.success ? 'COMPLETED' : 'FAILED',
      progress: 100,
      result: result.data
        ? (result.data as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      error: result.error ?? null,
      completedAt: new Date(),
    },
  });

  return result;
}

/**
 * Retry a failed processing job
 *
 * @param jobId - The failed ProcessingJob ID to retry
 * @returns New ProcessingJob record with result
 */
export async function retryProcessingJob(jobId: string): Promise<{
  newJob: { id: string; documentId: string; jobType: string; status: string; createdAt: Date };
  result: JobResult;
}> {
  // Get the existing job
  const existingJob = await db.processingJob.findUnique({
    where: { id: jobId },
    include: {
      document: {
        select: {
          id: true,
          sourcePath: true,
          status: true,
        },
      },
    },
  });

  if (!existingJob) {
    throw new Error('Job not found');
  }

  if (existingJob.status !== 'FAILED') {
    throw new Error(`Cannot retry job with status '${existingJob.status}'. Only failed jobs can be retried.`);
  }

  if (!existingJob.document) {
    throw new Error('Associated document not found');
  }

  // Create new processing job record
  const newProcessingJob = await db.processingJob.create({
    data: {
      documentId: existingJob.documentId,
      jobType: existingJob.jobType,
      status: 'PENDING',
    },
  });

  // Update document status back to PROCESSING
  await db.document.update({
    where: { id: existingJob.documentId },
    data: {
      status: 'PROCESSING',
      processingError: null,
    },
  });

  // Mark the old job as superseded
  await db.processingJob.update({
    where: { id: jobId },
    data: {
      error: `Superseded by retry job ${newProcessingJob.id}`,
    },
  });

  // Process synchronously
  const result = await processDocumentWithTracking(
    newProcessingJob.id,
    existingJob.documentId,
    existingJob.document.sourcePath,
    existingJob.jobType as JobType
  );

  // Fetch the updated job
  const updatedJob = await db.processingJob.findUnique({
    where: { id: newProcessingJob.id },
  });

  return {
    newJob: {
      id: updatedJob!.id,
      documentId: updatedJob!.documentId,
      jobType: updatedJob!.jobType,
      status: updatedJob!.status,
      createdAt: updatedJob!.createdAt,
    },
    result,
  };
}
