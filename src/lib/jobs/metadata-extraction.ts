/**
 * Metadata Extraction Job Processor
 *
 * Extracts metadata from PDF documents:
 * - Page count
 * - PDF version
 * - Title, author, subject, keywords
 * - Creation and modification dates
 * - Producer and creator applications
 * - PDF/A compliance indicator (basic check)
 *
 * Handles non-PDF files gracefully by returning basic file info.
 */

import { PDFDocument } from 'pdf-lib';
import { readFile, stat } from 'fs/promises';
import { extname } from 'path';
import { db } from '@/lib/db';
import { getFullPath } from '@/lib/storage';
import type { MetadataExtractionResultData } from '@/types/jobs';

/** MIME types for PDF files */
const PDF_MIME_TYPES = ['application/pdf', 'application/x-pdf'];

/** PDF file extensions */
const PDF_EXTENSIONS = ['.pdf'];

/** Extended metadata result including fields stored in Document table */
interface ExtendedMetadataResult extends MetadataExtractionResultData {
  pageCount?: number;
  pdfVersion?: string;
  isPdfA?: boolean;
  fileSize?: number;
  mimeType?: string;
  isNonPdf?: boolean;
}

/**
 * Extracts metadata from a document file
 *
 * @param documentId - The document ID in the database
 * @param filePath - Relative path to the file
 * @returns Metadata extraction result data
 */
export async function extractMetadata(
  documentId: string,
  filePath: string
): Promise<ExtendedMetadataResult> {
  const fullPath = getFullPath(filePath);

  // Update document status to PROCESSING
  await db.document.update({
    where: { id: documentId },
    data: { status: 'PROCESSING' },
  });

  try {
    // Get file stats
    const fileStats = await stat(fullPath);
    const fileSize = fileStats.size;

    // Determine file type
    const extension = extname(filePath).toLowerCase();
    const isPdf = PDF_EXTENSIONS.includes(extension);

    if (!isPdf) {
      // Handle non-PDF files gracefully
      return await handleNonPdfFile(documentId, filePath, extension, fileSize);
    }

    // Extract PDF metadata
    return await extractPdfMetadata(documentId, fullPath, fileSize);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during metadata extraction';

    console.error(`[MetadataExtraction] Failed for document ${documentId}:`, errorMessage);

    // Update document with error status
    await db.document.update({
      where: { id: documentId },
      data: {
        status: 'PROCESSING_FAILED',
        processingError: errorMessage,
      },
    });

    throw error;
  }
}

/**
 * Handles non-PDF files by returning basic file information
 */
async function handleNonPdfFile(
  documentId: string,
  _filePath: string,
  extension: string,
  fileSize: number
): Promise<ExtendedMetadataResult> {
  // Determine MIME type based on extension
  const mimeType = getMimeTypeFromExtension(extension);

  // Update document with basic info
  await db.document.update({
    where: { id: documentId },
    data: {
      fileSize,
      mimeType,
      status: 'PROCESSED',
      processingError: null,
    },
  });

  console.log(
    `[MetadataExtraction] Non-PDF file processed for document ${documentId}: ${extension}`
  );

  return {
    fileSize,
    mimeType,
    isNonPdf: true,
  };
}

/**
 * Extracts metadata from a PDF file
 */
async function extractPdfMetadata(
  documentId: string,
  fullPath: string,
  fileSize: number
): Promise<ExtendedMetadataResult> {
  // Read the PDF file
  const pdfBytes = await readFile(fullPath);

  // Verify PDF header
  const header = pdfBytes.subarray(0, 8).toString('utf-8');
  if (!header.startsWith('%PDF-')) {
    throw new Error('File does not appear to be a valid PDF (missing PDF header)');
  }

  // Load PDF document
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  // Extract page count
  const pageCount = pdfDoc.getPageCount();

  // Extract PDF version from header
  const pdfVersion = extractPdfVersion(pdfDoc);

  // Extract document metadata
  const title = pdfDoc.getTitle();
  const author = pdfDoc.getAuthor();
  const subject = pdfDoc.getSubject();
  const keywords = pdfDoc.getKeywords();
  const producer = pdfDoc.getProducer();
  const creator = pdfDoc.getCreator();
  const creationDate = pdfDoc.getCreationDate();
  const modificationDate = pdfDoc.getModificationDate();

  // Check for PDF/A compliance (basic check via XMP metadata markers)
  const isPdfA = checkPdfACompliance(pdfBytes);

  // Parse keywords into array if present
  const keywordsArray = keywords
    ? keywords.split(/[,;]/).map((k) => k.trim()).filter(Boolean)
    : undefined;

  // Update document record with extracted metadata
  await db.document.update({
    where: { id: documentId },
    data: {
      pageCount,
      pdfVersion,
      isPdfA,
      fileSize,
      mimeType: 'application/pdf',
      status: 'PROCESSED',
      processingError: null,
    },
  });

  console.log(
    `[MetadataExtraction] PDF metadata extracted for document ${documentId}: ` +
      `${pageCount} pages, version ${pdfVersion}, PDF/A: ${isPdfA}`
  );

  return {
    title: title || undefined,
    author: author || undefined,
    subject: subject || undefined,
    keywords: keywordsArray,
    creationDate: creationDate?.toISOString(),
    modificationDate: modificationDate?.toISOString(),
    producer: producer || undefined,
    creator: creator || undefined,
    pageCount,
    pdfVersion,
    isPdfA,
    fileSize,
    mimeType: 'application/pdf',
  };
}

/**
 * Extracts PDF version from document header
 */
function extractPdfVersion(pdfDoc: PDFDocument): string {
  try {
    const context = pdfDoc.context;
    const header = context.header;
    const headerString = header.toString();

    // Parse version from header string (format: "%PDF-X.Y")
    const versionMatch = headerString.match(/%PDF-(\d+\.\d+)/);
    return versionMatch ? versionMatch[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Checks for PDF/A compliance by looking for XMP metadata markers
 *
 * This is a basic check that looks for PDF/A namespace declarations
 * in the XMP metadata. A full compliance check would require
 * validation against PDF/A specifications.
 */
function checkPdfACompliance(pdfBytes: Buffer): boolean {
  try {
    // Convert to string for searching (use latin1 to preserve byte values)
    const pdfString = pdfBytes.toString('latin1');

    // Look for PDF/A identification namespace in XMP metadata
    // PDF/A documents typically contain this namespace declaration
    const pdfaNamespaces = [
      'pdfaid:part',
      'pdfaid:conformance',
      'http://www.aiim.org/pdfa/ns/id/',
      'xmlns:pdfaid',
    ];

    for (const marker of pdfaNamespaces) {
      if (pdfString.includes(marker)) {
        return true;
      }
    }

    // Also check for PDF/A identification schema
    if (pdfString.includes('PDF/A') && pdfString.includes('XMP')) {
      // Look for more specific PDF/A-1, PDF/A-2, PDF/A-3 markers
      const pdfaVersionPatterns = [
        /pdfaid:part\s*=\s*['"]?\d/i,
        /PDF\/A-\d[ab]?/i,
      ];

      for (const pattern of pdfaVersionPatterns) {
        if (pattern.test(pdfString)) {
          return true;
        }
      }
    }

    return false;
  } catch {
    // If we can't check, assume not PDF/A
    return false;
  }
}

/**
 * Gets MIME type from file extension
 */
function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.xml': 'application/xml',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.zip': 'application/zip',
    '.sas7bdat': 'application/x-sas-data',
    '.xpt': 'application/x-sas-xport',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}
