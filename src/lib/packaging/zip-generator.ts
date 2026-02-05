/**
 * ZIP Generator Service
 *
 * Creates ZIP archives for eCTD packages with all supporting artifacts.
 * Handles file copying, folder structure creation, and archive generation.
 */

import archiver from 'archiver';
import { createWriteStream, createReadStream } from 'fs';
import { mkdir, writeFile, stat, copyFile, readFile } from 'fs/promises';
import { join, dirname, normalize, isAbsolute, basename, relative } from 'path';
import { PDFDocument } from 'pdf-lib';
import { getFullPath } from '@/lib/storage';
import { generateEctdXml, type XmlGenerationOptions } from './xml-generator';
import type { LeafEntry, XmlGenerationResult, PackageFile } from './types';
import {
  processPdf,
  type BookmarkEntry,
  type PdfProcessingResult,
} from '@/lib/pdf';

/**
 * Validate that a target path is safe (not traversing outside the output directory)
 * @param targetPath - The path to validate
 * @throws Error if path is invalid (contains traversal or is absolute)
 */
function validateTargetPath(targetPath: string): void {
  const normalized = normalize(targetPath);
  if (normalized.startsWith('..') || isAbsolute(normalized)) {
    throw new Error(`Invalid target path: ${targetPath}`);
  }
}
import type { PackageManifest, FolderNode, CoverPageResult } from './types';
import type { BookmarkManifest, BookmarkNode } from './bookmarks';
import type { HyperlinkReport } from './hyperlinks';
import { exportReportAsCsv } from './hyperlinks';

/**
 * Convert BookmarkNode (from packaging) to BookmarkEntry (for PDF injection)
 *
 * BookmarkNode has: title, pageNumber?, children, sourceFile?, level
 * BookmarkEntry needs: title, pageNumber, children?, isOpen?
 */
function convertToBookmarkEntry(node: BookmarkNode): BookmarkEntry {
  return {
    title: node.title,
    pageNumber: node.pageNumber ?? 1, // Default to page 1 if not specified
    children: node.children.length > 0
      ? node.children.map(convertToBookmarkEntry)
      : undefined,
    isOpen: true, // Expand bookmarks by default
  };
}

/**
 * Build path map for hyperlink processing
 * Maps source file paths/names to their target eCTD paths
 */
function buildPathMap(files: PackageFile[]): Map<string, string> {
  const pathMap = new Map<string, string>();

  for (const file of files) {
    // Map by source path
    pathMap.set(file.sourcePath, file.targetPath);
    // Map by filename for looser matching
    pathMap.set(file.fileName, file.targetPath);
    // Map by basename of source path
    pathMap.set(basename(file.sourcePath), file.targetPath);
  }

  return pathMap;
}

/**
 * Process a PDF file with bookmarks and hyperlink fixing
 * Returns the processed PDF bytes or null if processing fails
 */
async function processPdfFile(
  sourcePath: string,
  targetPath: string,
  bookmarks: BookmarkEntry[],
  pathMap: Map<string, string>
): Promise<{ bytes: Uint8Array; result: PdfProcessingResult } | null> {
  try {
    const fullPath = getFullPath(sourcePath);
    const pdfBytes = await readFile(fullPath);

    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    const result = await processPdf(pdfDoc, {
      bookmarks: bookmarks.length > 0 ? bookmarks : undefined,
      processHyperlinks: true,
      hyperlinkOptions: {
        basePath: targetPath,
        pathMap,
        removeExternalLinks: false, // Flag but don't remove
        removeMailtoLinks: false,
      },
    });

    if (result.success) {
      const processedBytes = await pdfDoc.save();
      return { bytes: processedBytes, result };
    }

    return null;
  } catch (error) {
    console.warn(`[ZipGenerator] PDF processing failed for ${sourcePath}:`, error);
    return null;
  }
}

/**
 * Paths to all generated export artifacts
 */
export interface ExportArtifacts {
  /** Path to the final ZIP archive */
  packageZipPath: string;
  /** Path to the bookmark manifest JSON file */
  bookmarkManifestPath: string;
  /** Path to the hyperlink report CSV file */
  hyperlinkReportPath: string;
  /** Path to the QC summary JSON file */
  qcSummaryPath: string;
  /** Path to the generated index.xml file */
  indexXmlPath: string;
  /** Path to the regional XML file (us-regional.xml) */
  regionalXmlPath: string;
  /** XML generation result with leaf entries */
  xmlResult: XmlGenerationResult;
}

/**
 * QC summary for package validation
 */
export interface QcSummary {
  /** Study database ID */
  studyId: string;
  /** Protocol/study number */
  studyNumber: string;
  /** When the summary was generated */
  generatedAt: Date;
  /** Total number of files in the package */
  fileCount: number;
  /** Total size of all files in bytes */
  totalSize: number;
  /** Package readiness status */
  readiness: {
    ready: boolean;
    missingRequired: number;
    pendingApproval: number;
    validationErrors: number;
    unresolvedAnnotations: number;
  };
  /** Bookmark statistics */
  bookmarks: {
    totalCount: number;
    maxDepth: number;
    warnings: number;
  };
  /** Hyperlink statistics */
  hyperlinks: {
    totalCount: number;
    brokenCount: number;
    externalCount: number;
  };
  /** XML backbone statistics */
  xml: {
    /** Number of leaf entries in index.xml */
    leafCount: number;
    /** Whether index.xml was generated */
    hasIndexXml: boolean;
    /** Whether regional XML was generated */
    hasRegionalXml: boolean;
    /** XML generation warnings */
    warnings: number;
  };
  /** PDF processing statistics */
  pdfProcessing?: {
    /** Number of PDFs processed */
    processed: number;
    /** Number of PDFs where processing failed (original used) */
    failed: number;
    /** Total bookmarks injected */
    bookmarksInjected: number;
    /** Total hyperlinks processed */
    hyperlinksProcessed: number;
    /** Processing warnings */
    warnings: string[];
  };
}

/**
 * Result of PDF processing for a single file
 */
export interface PdfProcessingFileResult {
  fileName: string;
  success: boolean;
  bookmarksInjected?: number;
  hyperlinksProcessed?: number;
  warnings: string[];
  error?: string;
}

/**
 * Generate all export artifacts for a package
 *
 * Creates the full export structure including:
 * - eCTD XML backbone files (index.xml, us-regional.xml)
 * - eCTD folder structure with copied files
 * - Bookmark manifest JSON
 * - Hyperlink report CSV
 * - QC summary JSON
 * - Final ZIP archive
 *
 * @param manifest - Package manifest with file list and structure
 * @param bookmarks - Bookmark manifest for the package
 * @param hyperlinks - Hyperlink validation report
 * @param outputDir - Directory to write artifacts to
 * @param xmlOptions - Optional XML generation options
 * @param coverPage - Optional cover page result to include
 * @returns Paths to all generated artifacts
 */
export async function generateExportArtifacts(
  manifest: PackageManifest,
  bookmarks: BookmarkManifest,
  hyperlinks: HyperlinkReport,
  outputDir: string,
  xmlOptions?: XmlGenerationOptions,
  coverPage?: CoverPageResult
): Promise<ExportArtifacts> {
  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Create eCTD folder structure with PDF processing
  const ectdDir = join(outputDir, 'ectd');
  const structureResult = await createEctdStructure(manifest, ectdDir, {
    bookmarks,
    processPdfs: true,
  });

  // Write cover page to eCTD structure if provided
  if (coverPage) {
    const coverPath = join(ectdDir, coverPage.targetPath);
    const coverDir = dirname(coverPath);
    await mkdir(coverDir, { recursive: true });
    await writeFile(coverPath, coverPage.pdfBytes);
  }

  // Generate eCTD XML backbone files
  const xmlResult = await generateEctdXml(manifest, xmlOptions);

  // Write index.xml to eCTD root
  const indexXmlPath = join(ectdDir, 'index.xml');
  await writeFile(indexXmlPath, xmlResult.indexXml, 'utf-8');

  // Write regional XML if generated
  const regionalXmlPath = join(ectdDir, 'us-regional.xml');
  if (xmlResult.regionalXml) {
    await writeFile(regionalXmlPath, xmlResult.regionalXml, 'utf-8');
  }

  // Generate bookmark manifest JSON
  const bookmarkManifestPath = join(outputDir, 'bookmark-manifest.json');
  await writeFile(
    bookmarkManifestPath,
    JSON.stringify(bookmarks, null, 2),
    'utf-8'
  );

  // Generate hyperlink report CSV
  const hyperlinkReportPath = join(outputDir, 'hyperlink-report.csv');
  const csvContent = exportReportAsCsv(hyperlinks);
  await writeFile(hyperlinkReportPath, csvContent, 'utf-8');

  // Build and write QC summary (now includes XML and PDF processing info)
  const qcSummary = buildQcSummary(manifest, bookmarks, hyperlinks, xmlResult, structureResult);
  const qcSummaryPath = join(outputDir, 'qc-summary.json');
  await writeFile(qcSummaryPath, JSON.stringify(qcSummary, null, 2), 'utf-8');

  // Create ZIP archive
  const packageZipPath = join(outputDir, 'package.zip');
  await createZipArchive(ectdDir, packageZipPath);

  return {
    packageZipPath,
    bookmarkManifestPath,
    hyperlinkReportPath,
    qcSummaryPath,
    indexXmlPath,
    regionalXmlPath,
    xmlResult,
  };
}

/**
 * Options for eCTD structure creation
 */
export interface EctdStructureOptions {
  /** Bookmark manifest for injecting bookmarks into PDFs */
  bookmarks?: BookmarkManifest;
  /** Whether to process PDFs (default: true) */
  processPdfs?: boolean;
}

/**
 * Result of eCTD structure creation
 */
export interface EctdStructureResult {
  /** PDF processing results for each file */
  pdfResults: PdfProcessingFileResult[];
  /** Aggregate statistics */
  stats: {
    processed: number;
    failed: number;
    bookmarksInjected: number;
    hyperlinksProcessed: number;
  };
}

/**
 * Create the eCTD folder structure and copy files
 *
 * Builds the directory tree based on the manifest's folder structure
 * and copies source files to their target locations.
 * For PDF files, processes them to inject bookmarks and fix hyperlinks.
 *
 * @param manifest - Package manifest with file list
 * @param outputDir - Root directory for eCTD structure
 * @param options - Optional processing options
 * @returns Processing results for PDFs
 */
export async function createEctdStructure(
  manifest: PackageManifest,
  outputDir: string,
  options: EctdStructureOptions = {}
): Promise<EctdStructureResult> {
  const { bookmarks, processPdfs = true } = options;

  // Create all directories from the folder structure
  await createFolderStructure(manifest.folderStructure, outputDir);

  // Build path map for hyperlink processing
  const pathMap = buildPathMap(manifest.files);

  // Build a map of document IDs to their bookmark entries
  const documentBookmarkMap = new Map<string, BookmarkEntry[]>();
  if (bookmarks) {
    for (const docBookmarks of bookmarks.documentBookmarks) {
      if (docBookmarks.bookmarks.length > 0) {
        const entries = docBookmarks.bookmarks.map(convertToBookmarkEntry);
        documentBookmarkMap.set(docBookmarks.documentId, entries);
      }
    }
  }

  const pdfResults: PdfProcessingFileResult[] = [];
  let processed = 0;
  let failed = 0;
  let totalBookmarks = 0;
  let totalHyperlinks = 0;

  // Process each file
  for (const file of manifest.files) {
    // Validate target path before using it
    validateTargetPath(file.targetPath);

    const sourcePath = getFullPath(file.sourcePath);
    const targetPath = join(outputDir, file.targetPath);

    // Ensure parent directory exists
    const parentDir = dirname(targetPath);
    await mkdir(parentDir, { recursive: true });

    const isPdf = file.fileName.toLowerCase().endsWith('.pdf');

    // Process PDF files
    if (isPdf && processPdfs) {
      // Get bookmarks for this document
      const docBookmarks = documentBookmarkMap.get(file.sourceDocumentId) || [];

      // Try to process the PDF
      const processResult = await processPdfFile(
        file.sourcePath,
        file.targetPath,
        docBookmarks,
        pathMap
      );

      if (processResult) {
        // Write processed PDF
        await writeFile(targetPath, processResult.bytes);

        const bookmarksInjected = processResult.result.bookmarkResult?.bookmarkCount ?? 0;
        const hyperlinksProcessed = processResult.result.hyperlinkResult?.totalLinks ?? 0;

        totalBookmarks += bookmarksInjected;
        totalHyperlinks += hyperlinksProcessed;
        processed++;

        pdfResults.push({
          fileName: file.fileName,
          success: true,
          bookmarksInjected,
          hyperlinksProcessed,
          warnings: processResult.result.warnings,
        });
      } else {
        // Processing failed - copy original file with warning
        await copyFileWithStream(sourcePath, targetPath);
        failed++;

        pdfResults.push({
          fileName: file.fileName,
          success: false,
          warnings: [],
          error: 'PDF processing failed, original file included',
        });
      }
    } else {
      // Non-PDF files or processing disabled - copy as-is
      await copyFileWithStream(sourcePath, targetPath);
    }
  }

  return {
    pdfResults,
    stats: {
      processed,
      failed,
      bookmarksInjected: totalBookmarks,
      hyperlinksProcessed: totalHyperlinks,
    },
  };
}

/**
 * Recursively create folder structure
 */
async function createFolderStructure(
  nodes: FolderNode[],
  basePath: string
): Promise<void> {
  for (const node of nodes) {
    const nodePath = join(basePath, node.path);
    await mkdir(nodePath, { recursive: true });

    // Recursively create child folders
    if (node.children.length > 0) {
      await createFolderStructure(node.children, basePath);
    }
  }
}

/**
 * Copy a file using streams for efficient large file handling
 */
async function copyFileWithStream(
  sourcePath: string,
  targetPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const readStream = createReadStream(sourcePath);
    const writeStream = createWriteStream(targetPath);

    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);

    readStream.pipe(writeStream);
  });
}

/**
 * Generate ZIP archive of the package
 *
 * Creates a compressed ZIP archive from the eCTD folder structure.
 * Uses archiver library for efficient streaming compression.
 *
 * @param sourceDir - Directory to archive
 * @param outputPath - Path to write the ZIP file
 * @returns Object with the final archive size
 */
export async function createZipArchive(
  sourceDir: string,
  outputPath: string
): Promise<{ size: number }> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 6 }, // Compression level (0-9)
    });

    output.on('close', async () => {
      try {
        const stats = await stat(outputPath);
        resolve({ size: stats.size });
      } catch {
        resolve({ size: archive.pointer() });
      }
    });

    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('[ZipGenerator] Warning:', err.message);
      } else {
        reject(err);
      }
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Add the entire directory to the archive
    archive.directory(sourceDir, false);

    // Finalize the archive
    archive.finalize();
  });
}

/**
 * Build QC summary from all artifacts
 *
 * Aggregates information from the manifest, bookmarks, hyperlinks, XML,
 * and PDF processing into a comprehensive quality control summary.
 *
 * @param manifest - Package manifest
 * @param bookmarks - Bookmark manifest
 * @param hyperlinks - Hyperlink report
 * @param xmlResult - Optional XML generation result
 * @param pdfResult - Optional PDF processing result
 * @returns QC summary object
 */
export function buildQcSummary(
  manifest: PackageManifest,
  bookmarks: BookmarkManifest,
  hyperlinks: HyperlinkReport,
  xmlResult?: XmlGenerationResult,
  pdfResult?: EctdStructureResult
): QcSummary {
  // Calculate total file size
  const totalSize = manifest.files.reduce((sum, file) => sum + file.fileSize, 0);

  // Collect all PDF processing warnings
  const pdfWarnings: string[] = [];
  if (pdfResult) {
    for (const result of pdfResult.pdfResults) {
      pdfWarnings.push(...result.warnings);
      if (result.error) {
        pdfWarnings.push(`${result.fileName}: ${result.error}`);
      }
    }
  }

  return {
    studyId: manifest.studyId,
    studyNumber: manifest.studyNumber,
    generatedAt: new Date(),
    fileCount: manifest.files.length,
    totalSize,
    readiness: {
      ready: manifest.readiness.ready,
      missingRequired: manifest.readiness.missingRequired.length,
      pendingApproval: manifest.readiness.pendingApproval.length,
      validationErrors: manifest.readiness.validationErrors,
      unresolvedAnnotations: manifest.readiness.unresolvedAnnotations,
    },
    bookmarks: {
      totalCount: bookmarks.totalCount,
      maxDepth: bookmarks.maxDepth,
      warnings: bookmarks.warnings.length,
    },
    hyperlinks: {
      totalCount: hyperlinks.totalLinks,
      brokenCount: hyperlinks.brokenLinks.length,
      externalCount: hyperlinks.externalLinks.length,
    },
    xml: {
      leafCount: xmlResult?.leafEntries.length ?? 0,
      hasIndexXml: !!xmlResult?.indexXml,
      hasRegionalXml: !!xmlResult?.regionalXml,
      warnings: xmlResult?.warnings.length ?? 0,
    },
    pdfProcessing: pdfResult ? {
      processed: pdfResult.stats.processed,
      failed: pdfResult.stats.failed,
      bookmarksInjected: pdfResult.stats.bookmarksInjected,
      hyperlinksProcessed: pdfResult.stats.hyperlinksProcessed,
      warnings: pdfWarnings,
    } : undefined,
  };
}
