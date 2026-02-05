/**
 * PDF Conversion Job Processor
 *
 * Converts Word documents (.doc, .docx, .rtf, .odt) to PDF
 * using LibreOffice in headless mode.
 */

import { spawn } from 'child_process';
import { mkdir, stat, unlink } from 'fs/promises';
import { join, extname, basename } from 'path';
import { v4 as uuid } from 'uuid';
import { db } from '@/lib/db';
import { getFullPath } from '@/lib/storage';

/** File extensions that can be converted to PDF */
const CONVERTIBLE_EXTENSIONS = ['.doc', '.docx', '.rtf', '.odt'];

/** Conversion timeout in milliseconds (30 seconds) */
const CONVERSION_TIMEOUT_MS = 30000;

/** Common LibreOffice installation paths by platform */
const LIBREOFFICE_PATHS: Record<string, string[]> = {
  win32: [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  ],
  darwin: [
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/opt/homebrew/bin/soffice',
    '/usr/local/bin/soffice',
  ],
  linux: [
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/usr/local/bin/soffice',
    '/snap/bin/libreoffice',
  ],
};

export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

/**
 * Finds the LibreOffice binary on the system
 * @returns Path to LibreOffice binary or null if not found
 */
export async function findLibreOffice(): Promise<string | null> {
  const platform = process.platform;
  const paths = LIBREOFFICE_PATHS[platform] || LIBREOFFICE_PATHS.linux;

  for (const path of paths) {
    try {
      await stat(path);
      return path;
    } catch {
      // Path doesn't exist, try next
    }
  }

  return null;
}

/**
 * Checks if a file can be converted to PDF
 * @param filePath - Path to the file
 * @returns true if the file extension is supported
 */
export function isConvertible(filePath: string): boolean {
  const extension = extname(filePath).toLowerCase();
  return CONVERTIBLE_EXTENSIONS.includes(extension);
}

/**
 * Converts a document to PDF using LibreOffice
 *
 * @param documentId - The document ID in the database
 * @param filePath - Relative path to the source file
 * @returns Conversion result with output path on success
 */
export async function convertDocument(
  documentId: string,
  filePath: string
): Promise<ConversionResult> {
  const fullPath = getFullPath(filePath);
  const extension = extname(filePath).toLowerCase();

  // Validate file type
  if (!CONVERTIBLE_EXTENSIONS.includes(extension)) {
    return {
      success: false,
      error: `Unsupported file type: ${extension}. Supported types: ${CONVERTIBLE_EXTENSIONS.join(', ')}`,
    };
  }

  // Find LibreOffice
  const libreofficePath = await findLibreOffice();
  if (!libreofficePath) {
    console.error('[PDFConversion] LibreOffice not found on system');
    return {
      success: false,
      error: 'LibreOffice not installed. Please install LibreOffice to enable document conversion.',
    };
  }

  // Ensure processed directory exists
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const processedDir = join(uploadDir, 'processed');
  await mkdir(processedDir, { recursive: true });

  // Generate output filename
  const outputFilename = `${uuid()}.pdf`;
  const outputPath = join('processed', outputFilename);
  const fullOutputPath = join(uploadDir, outputPath);

  console.log(`[PDFConversion] Converting document ${documentId}: ${filePath} -> ${outputPath}`);

  try {
    // Run LibreOffice conversion
    await runLibreOfficeConversion(libreofficePath, fullPath, processedDir);

    // LibreOffice outputs file with same name but .pdf extension in the output directory
    const sourceBasename = basename(fullPath, extname(fullPath));
    const libreofficeOutputPath = join(processedDir, `${sourceBasename}.pdf`);

    // Verify output exists
    try {
      await stat(libreofficeOutputPath);
    } catch {
      return {
        success: false,
        error: 'Conversion completed but output file not found',
      };
    }

    // Rename to our UUID-based filename if needed
    if (libreofficeOutputPath !== fullOutputPath) {
      const { rename } = await import('fs/promises');
      await rename(libreofficeOutputPath, fullOutputPath);
    }

    // Update document record with processed path
    await db.document.update({
      where: { id: documentId },
      data: {
        processedPath: outputPath,
      },
    });

    console.log(`[PDFConversion] Successfully converted document ${documentId}`);

    return {
      success: true,
      outputPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';
    console.error(`[PDFConversion] Failed for document ${documentId}:`, errorMessage);

    // Clean up any partial output
    try {
      await unlink(fullOutputPath);
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Runs LibreOffice in headless mode to convert a document
 *
 * @param libreofficePath - Path to soffice binary
 * @param inputPath - Full path to input file
 * @param outputDir - Directory for output file
 */
function runLibreOfficeConversion(
  libreofficePath: string,
  inputPath: string,
  outputDir: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', outputDir,
      inputPath,
    ];

    const process = spawn(libreofficePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // Set up timeout
    const timeout = setTimeout(() => {
      process.kill('SIGTERM');
      reject(new Error(`Conversion timed out after ${CONVERSION_TIMEOUT_MS / 1000} seconds`));
    }, CONVERSION_TIMEOUT_MS);

    process.on('close', (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve();
      } else {
        const errorOutput = stderr || stdout || `Process exited with code ${code}`;
        reject(new Error(`LibreOffice conversion failed: ${errorOutput}`));
      }
    });

    process.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start LibreOffice: ${err.message}`));
    });
  });
}
