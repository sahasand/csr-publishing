/**
 * PDF Validation Check Functions
 *
 * Individual check functions for PDF validation.
 * Each function validates a specific aspect of a PDF file.
 */

import { PDFDocument } from 'pdf-lib';
import { readFile, stat } from 'fs/promises';
import type { CheckResult } from './index';

/**
 * Check file size against maximum allowed
 * @param filePath - Full path to the PDF file
 * @param params - { maxMB: number } - Maximum file size in megabytes
 */
export async function checkFileSize(
  filePath: string,
  params: Record<string, unknown>
): Promise<CheckResult> {
  const maxMB = (params.maxMB as number) ?? 100;
  const maxBytes = maxMB * 1024 * 1024;

  try {
    const stats = await stat(filePath);
    const fileSize = stats.size;
    const fileSizeMB = fileSize / (1024 * 1024);

    if (fileSize > maxBytes) {
      return {
        passed: false,
        message: `File size (${fileSizeMB.toFixed(2)}MB) exceeds maximum of ${maxMB}MB`,
        details: { fileSize, fileSizeMB: fileSizeMB.toFixed(2), maxMB, maxBytes },
      };
    }

    return {
      passed: true,
      message: `File size (${fileSizeMB.toFixed(2)}MB) is within ${maxMB}MB limit`,
      details: { fileSize, fileSizeMB: fileSizeMB.toFixed(2), maxMB, maxBytes },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}

/**
 * Check if PDF can be parsed (not corrupted)
 * @param filePath - Full path to the PDF file
 */
export async function checkPdfParseable(
  filePath: string,
  _params: Record<string, unknown>
): Promise<CheckResult> {
  try {
    const pdfBytes = await readFile(filePath);

    // Check PDF magic number (%PDF-)
    const header = pdfBytes.subarray(0, 8).toString('utf-8');
    if (!header.startsWith('%PDF-')) {
      return {
        passed: false,
        message: 'File does not appear to be a valid PDF (missing PDF header)',
        details: { header: header.substring(0, 5) },
      };
    }

    // Try to actually load the PDF
    await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    return {
      passed: true,
      message: 'PDF file is valid and can be parsed',
    };
  } catch (error) {
    return {
      passed: false,
      message: `PDF is corrupted or invalid: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}

/**
 * Check PDF version is within allowed versions
 * @param filePath - Full path to the PDF file
 * @param params - { allowedVersions: string[] } - List of allowed PDF versions
 */
export async function checkPdfVersion(
  filePath: string,
  params: Record<string, unknown>
): Promise<CheckResult> {
  const allowedVersions = (params.allowedVersions as string[]) ?? ['1.4', '1.5', '1.6', '1.7'];

  try {
    const pdfBytes = await readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // Extract version from the header string (e.g., "%PDF-1.4")
    const context = pdfDoc.context;
    const header = context.header;
    const headerString = header.toString();

    // Parse version from header string (format: "%PDF-X.Y")
    const versionMatch = headerString.match(/%PDF-(\d+\.\d+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';

    if (version === 'unknown') {
      return {
        passed: false,
        message: 'Unable to determine PDF version',
        details: { version, headerString, allowedVersions },
      };
    }

    const isAllowed = allowedVersions.includes(version);

    if (!isAllowed) {
      return {
        passed: false,
        message: `PDF version ${version} is not allowed. Allowed versions: ${allowedVersions.join(', ')}`,
        details: { version, allowedVersions },
      };
    }

    return {
      passed: true,
      message: `PDF version ${version} is allowed`,
      details: { version, allowedVersions },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to check PDF version: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}

/**
 * Check that PDF is not encrypted
 * @param filePath - Full path to the PDF file
 */
export async function checkNotEncrypted(
  filePath: string,
  _params: Record<string, unknown>
): Promise<CheckResult> {
  try {
    const pdfBytes = await readFile(filePath);

    // Check for encryption by looking for /Encrypt in the trailer
    const pdfString = pdfBytes.toString('latin1');
    const hasEncryptDict = pdfString.includes('/Encrypt');

    // Also try to load without ignoring encryption to see if it fails
    try {
      await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
    } catch (error) {
      if (error instanceof Error && error.message.includes('encrypt')) {
        return {
          passed: false,
          message: 'PDF is encrypted. eCTD submissions must not be password-protected',
          details: { encrypted: true },
        };
      }
      // Other errors are not encryption-related
    }

    if (hasEncryptDict) {
      return {
        passed: false,
        message: 'PDF contains encryption dictionary. eCTD submissions should not have any security restrictions',
        details: { encrypted: true, hasEncryptDict: true },
      };
    }

    return {
      passed: true,
      message: 'PDF is not encrypted',
      details: { encrypted: false },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to check encryption status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}

/**
 * Check that fonts are embedded in the PDF
 * @param filePath - Full path to the PDF file
 */
export async function checkFontsEmbedded(
  filePath: string,
  _params: Record<string, unknown>
): Promise<CheckResult> {
  try {
    const pdfBytes = await readFile(filePath);
    const pdfString = pdfBytes.toString('latin1');

    // Look for font subtype indicators that suggest non-embedded fonts
    // Type1, TrueType, and CIDFontType2 fonts should have FontFile, FontFile2, or FontFile3
    // entries if they are embedded

    // Check for /Type /Font entries
    const fontMatches = pdfString.match(/\/Type\s*\/Font/g);
    const fontCount = fontMatches ? fontMatches.length : 0;

    // Check for embedded font indicators
    const fontFileMatches = pdfString.match(/\/FontFile[23]?\s/g);
    const embeddedCount = fontFileMatches ? fontFileMatches.length : 0;

    // Check for standard fonts that don't need embedding
    const standardFonts = [
      'Helvetica', 'Times-Roman', 'Courier', 'Symbol', 'ZapfDingbats',
      'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
      'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
      'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
    ];

    // Check for non-embedded fonts (fonts with BaseFont but no FontFile)
    const baseFontMatches = pdfString.match(/\/BaseFont\s*\/([A-Za-z0-9+-]+)/g);
    const baseFonts = baseFontMatches
      ? baseFontMatches.map(m => m.replace(/\/BaseFont\s*\//, ''))
      : [];

    // Filter out standard fonts and subsetted fonts (prefixed with 6-char identifier+)
    const nonStandardFonts = baseFonts.filter(font => {
      // Remove subset prefix if present (e.g., "ABCDEF+Arial" -> "Arial")
      const fontName = font.includes('+') ? font.split('+')[1] : font;
      return !standardFonts.includes(fontName);
    });

    // If there are fonts but none appear embedded, this is a warning
    if (fontCount > 0 && embeddedCount === 0 && nonStandardFonts.length > 0) {
      return {
        passed: false,
        message: `PDF may contain non-embedded fonts. Found ${nonStandardFonts.length} non-standard font(s) that may not be embedded.`,
        details: {
          totalFonts: fontCount,
          embeddedIndicators: embeddedCount,
          nonStandardFonts: nonStandardFonts.slice(0, 10), // Limit to first 10
        },
      };
    }

    return {
      passed: true,
      message: fontCount > 0
        ? `PDF fonts appear to be properly embedded (${embeddedCount} font file indicators found)`
        : 'No fonts detected in PDF',
      details: {
        totalFonts: fontCount,
        embeddedIndicators: embeddedCount,
        nonStandardFonts: nonStandardFonts.slice(0, 10),
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to check font embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}

/**
 * Check PDF/A compliance by examining metadata
 * @param filePath - Full path to the PDF file
 * @param params - { allowedVersions?: string[] } - Optional list of allowed PDF/A versions (e.g., ["1a", "1b", "2a", "2b"])
 */
export async function checkPdfACompliance(
  filePath: string,
  params: Record<string, unknown>
): Promise<CheckResult> {
  const allowedVersions = params.allowedVersions as string[] | undefined;

  try {
    const pdfBytes = await readFile(filePath);
    const pdfString = pdfBytes.toString('latin1');

    // Look for PDF/A identification in XMP metadata
    // PDF/A documents must contain pdfaid:part and pdfaid:conformance in their XMP metadata
    const hasPdfANamespace = pdfString.includes('pdfaid:part') ||
                             pdfString.includes('http://www.aiim.org/pdfa/ns/id/');

    // Try to extract PDF/A version
    const partMatch = pdfString.match(/pdfaid:part[>\s]*(\d)/);
    const conformanceMatch = pdfString.match(/pdfaid:conformance[>\s]*([ABU])/i);

    const pdfaPart = partMatch ? partMatch[1] : null;
    const pdfaConformance = conformanceMatch ? conformanceMatch[1].toLowerCase() : null;
    const pdfaVersion = pdfaPart && pdfaConformance
      ? `${pdfaPart}${pdfaConformance}`
      : null;

    if (!hasPdfANamespace || !pdfaVersion) {
      return {
        passed: false,
        message: 'PDF does not appear to be PDF/A compliant (no PDF/A identification found)',
        details: {
          isPdfA: false,
          hasPdfANamespace,
          pdfaPart,
          pdfaConformance,
        },
      };
    }

    // Check if the version is in the allowed list (if specified)
    if (allowedVersions && allowedVersions.length > 0) {
      const normalizedAllowed = allowedVersions.map(v => v.toLowerCase());
      if (!normalizedAllowed.includes(pdfaVersion.toLowerCase())) {
        return {
          passed: false,
          message: `PDF/A version ${pdfaVersion} is not in the allowed list: ${allowedVersions.join(', ')}`,
          details: {
            isPdfA: true,
            pdfaVersion,
            allowedVersions,
          },
        };
      }
    }

    return {
      passed: true,
      message: `PDF is PDF/A-${pdfaVersion} compliant`,
      details: {
        isPdfA: true,
        pdfaVersion,
        pdfaPart,
        pdfaConformance,
        allowedVersions,
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to check PDF/A compliance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}

/**
 * Check page count is within limits
 * @param filePath - Full path to the PDF file
 * @param params - { minPages?: number, maxPages?: number }
 */
export async function checkPageCount(
  filePath: string,
  params: Record<string, unknown>
): Promise<CheckResult> {
  const minPages = (params.minPages as number) ?? 1;
  const maxPages = (params.maxPages as number) ?? undefined;

  try {
    const pdfBytes = await readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();

    if (pageCount < minPages) {
      return {
        passed: false,
        message: `PDF has ${pageCount} page(s), minimum required is ${minPages}`,
        details: { pageCount, minPages, maxPages },
      };
    }

    if (maxPages !== undefined && pageCount > maxPages) {
      return {
        passed: false,
        message: `PDF has ${pageCount} page(s), maximum allowed is ${maxPages}`,
        details: { pageCount, minPages, maxPages },
      };
    }

    return {
      passed: true,
      message: `PDF has ${pageCount} page${pageCount === 1 ? '' : 's'}`,
      details: { pageCount, minPages, maxPages },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to check page count: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}
