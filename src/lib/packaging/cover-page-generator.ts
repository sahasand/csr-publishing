/**
 * Cover Page Generator
 *
 * Generates a hyperlinked PDF cover page for eCTD packages.
 * Includes study metadata, table of contents with cross-document links,
 * and PDF bookmarks matching the TOC structure.
 */

import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
  PDFDict,
  PDFArray,
  PDFName,
  PDFString,
  PDFNumber,
} from 'pdf-lib';

import {
  PackageManifest,
  PackageFile,
  CoverPageConfig,
  CoverPageMetadata,
  CoverPageResult,
  TocEntry,
  DEFAULT_COVER_PAGE_CONFIG,
} from './types';

import {
  injectBookmarks,
  BookmarkEntry,
} from '../pdf/bookmark-writer';

/** Cover page target path in eCTD structure */
const COVER_PAGE_PATH = 'm1/us/cover.pdf';

/** Link color (blue) */
const LINK_COLOR = rgb(0, 0, 0.8);

/** Text color (black) */
const TEXT_COLOR = rgb(0, 0, 0);

/**
 * Build hierarchical TOC entries from package manifest files
 */
export function buildTocFromManifest(files: PackageFile[]): TocEntry[] {
  // Sort files by node code numerically
  const sortedFiles = [...files].sort((a, b) => {
    const partsA = a.nodeCode.split('.').map(Number);
    const partsB = b.nodeCode.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] ?? 0;
      const numB = partsB[i] ?? 0;
      if (numA !== numB) return numA - numB;
    }
    return 0;
  });

  // Build flat TOC entries
  const entries: TocEntry[] = sortedFiles.map((file) => ({
    title: `${file.nodeCode} - ${file.nodeTitle}`,
    level: file.nodeCode.split('.').length - 1,
    targetPath: file.targetPath,
    pageCount: file.pageCount,
  }));

  return entries;
}

/**
 * Calculate relative path from cover page to target document
 *
 * Cover page at: m1/us/cover.pdf
 * Target at: m5/study-001/16-1/file.pdf
 * Returns: ../../m5/study-001/16-1/file.pdf
 */
export function calculateRelativePath(
  coverPagePath: string,
  targetPath: string
): string {
  const coverParts = coverPagePath.split('/');
  const targetParts = targetPath.split('/');

  // Remove filename from cover path to get directory
  coverParts.pop();

  // Count directories to go up from cover page location
  const upCount = coverParts.length;
  const ups = Array(upCount).fill('..').join('/');

  return ups ? `${ups}/${targetPath}` : targetPath;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Create a GoToR (go to remote) link annotation for cross-document linking
 */
function createGoToRAnnotation(
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number },
  relativePath: string
): void {
  const { context } = page.doc;

  // Create file specification
  const fileSpec = context.obj({
    Type: 'Filespec',
    F: PDFString.of(relativePath),
    UF: PDFString.of(relativePath),
  });

  // Create GoToR action
  const action = context.obj({
    S: 'GoToR',
    F: fileSpec,
    D: PDFArray.withContext(context),  // First page
  });

  // Set destination to first page with fit view
  const destArray = action.get(PDFName.of('D')) as PDFArray;
  destArray.push(PDFNumber.of(0));  // Page index
  destArray.push(PDFName.of('Fit'));

  // Create link annotation
  const annot = context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
    Border: [0, 0, 0],  // No visible border
    A: action,
  });

  // Add annotation to page
  const annotsKey = PDFName.of('Annots');
  let annots = page.node.get(annotsKey);

  if (!annots) {
    annots = context.obj([]);
    page.node.set(annotsKey, annots);
  }

  const annotsArray = annots as PDFArray;
  annotsArray.push(context.register(annot));
}

/**
 * Simple text drawing helper that tracks Y position
 */
class TextDrawer {
  private y: number;
  private page: PDFPage;
  private font: PDFFont;
  private boldFont: PDFFont;
  private config: Required<CoverPageConfig>;
  private contentWidth: number;

  constructor(
    page: PDFPage,
    font: PDFFont,
    boldFont: PDFFont,
    config: Required<CoverPageConfig>
  ) {
    this.page = page;
    this.font = font;
    this.boldFont = boldFont;
    this.config = config;
    this.y = config.pageHeight - config.margins.top;
    this.contentWidth = config.pageWidth - config.margins.left - config.margins.right;
  }

  getCurrentY(): number {
    return this.y;
  }

  hasSpace(height: number): boolean {
    return this.y - height > this.config.margins.bottom;
  }

  drawTitle(text: string): void {
    const fontSize = this.config.fontSize.title;
    const textWidth = this.boldFont.widthOfTextAtSize(text, fontSize);
    const x = (this.config.pageWidth - textWidth) / 2;  // Center

    this.page.drawText(text, {
      x,
      y: this.y,
      size: fontSize,
      font: this.boldFont,
      color: TEXT_COLOR,
    });

    this.y -= fontSize * this.config.lineHeight;
  }

  drawSubtitle(text: string): void {
    const fontSize = this.config.fontSize.heading;
    const textWidth = this.font.widthOfTextAtSize(text, fontSize);
    const x = (this.config.pageWidth - textWidth) / 2;  // Center

    this.page.drawText(text, {
      x,
      y: this.y,
      size: fontSize,
      font: this.font,
      color: TEXT_COLOR,
    });

    this.y -= fontSize * this.config.lineHeight;
  }

  drawHeading(text: string): void {
    const fontSize = this.config.fontSize.heading;

    this.page.drawText(text, {
      x: this.config.margins.left,
      y: this.y,
      size: fontSize,
      font: this.boldFont,
      color: TEXT_COLOR,
    });

    this.y -= fontSize * this.config.lineHeight;
  }

  drawLine(label: string, value: string): void {
    const fontSize = this.config.fontSize.body;

    this.page.drawText(`${label}: `, {
      x: this.config.margins.left,
      y: this.y,
      size: fontSize,
      font: this.boldFont,
      color: TEXT_COLOR,
    });

    const labelWidth = this.boldFont.widthOfTextAtSize(`${label}: `, fontSize);

    this.page.drawText(value, {
      x: this.config.margins.left + labelWidth,
      y: this.y,
      size: fontSize,
      font: this.font,
      color: TEXT_COLOR,
    });

    this.y -= fontSize * this.config.lineHeight;
  }

  drawSeparator(): void {
    const y = this.y + 5;
    this.page.drawLine({
      start: { x: this.config.margins.left, y },
      end: { x: this.config.pageWidth - this.config.margins.right, y },
      thickness: 0.5,
      color: rgb(0.5, 0.5, 0.5),
    });
    this.y -= 15;
  }

  space(points: number): void {
    this.y -= points;
  }

  /**
   * Draw a TOC entry with hyperlink
   * Returns the link rect for annotation
   */
  drawTocEntry(
    entry: TocEntry,
    relativePath: string
  ): { x: number; y: number; width: number; height: number } {
    const fontSize = this.config.fontSize.body;
    const indent = entry.level * 20;
    const x = this.config.margins.left + indent;

    // Build title with page count
    let displayText = entry.title;
    if (entry.pageCount) {
      displayText += ` [${entry.pageCount} pg]`;
    }

    // Truncate if too long
    const maxWidth = this.contentWidth - indent - 20;
    let truncated = displayText;
    while (this.font.widthOfTextAtSize(truncated, fontSize) > maxWidth && truncated.length > 10) {
      truncated = truncated.slice(0, -4) + '...';
    }

    const textWidth = this.font.widthOfTextAtSize(truncated, fontSize);

    // Draw text in link color
    this.page.drawText(truncated, {
      x,
      y: this.y,
      size: fontSize,
      font: this.font,
      color: LINK_COLOR,
    });

    // Calculate rect for link annotation (slightly larger than text)
    const rect = {
      x: x - 2,
      y: this.y - 3,
      width: textWidth + 4,
      height: fontSize + 4,
    };

    // Add the link annotation
    createGoToRAnnotation(this.page, rect, relativePath);

    this.y -= fontSize * this.config.lineHeight;

    return rect;
  }
}

/**
 * Convert TOC entries to bookmark entries for PDF outline
 */
function tocToBookmarks(entries: TocEntry[]): BookmarkEntry[] {
  return entries.map((entry, index) => ({
    title: entry.title,
    pageNumber: 1,  // All point to page 1 of cover page
    children: entry.children ? tocToBookmarks(entry.children) : undefined,
  }));
}

/**
 * Generate a cover page PDF with hyperlinked table of contents
 */
export async function generateCoverPage(
  manifest: PackageManifest,
  metadata: CoverPageMetadata,
  config: Partial<CoverPageConfig> = {}
): Promise<CoverPageResult> {
  const warnings: string[] = [];

  // Merge config with defaults
  const fullConfig: Required<CoverPageConfig> = {
    ...DEFAULT_COVER_PAGE_CONFIG,
    ...config,
    margins: { ...DEFAULT_COVER_PAGE_CONFIG.margins, ...config.margins },
    fontSize: { ...DEFAULT_COVER_PAGE_CONFIG.fontSize, ...config.fontSize },
  } as Required<CoverPageConfig>;

  // Create PDF document
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Build TOC from manifest
  const tocEntries = buildTocFromManifest(manifest.files);

  // Create first page
  let page = pdfDoc.addPage([fullConfig.pageWidth, fullConfig.pageHeight]);
  let drawer = new TextDrawer(page, font, boldFont, fullConfig);
  let linkCount = 0;

  // === Header Section ===
  drawer.drawTitle('CLINICAL STUDY REPORT');
  drawer.drawSubtitle('Electronic Common Technical Document Package');
  drawer.space(20);
  drawer.drawSeparator();
  drawer.space(10);

  // Metadata lines
  drawer.drawLine('Sponsor', metadata.sponsor);
  drawer.drawLine('Protocol', metadata.studyNumber);

  if (metadata.productName) {
    drawer.drawLine('Product', metadata.productName);
  }
  if (metadata.applicationNumber) {
    const appText = metadata.applicationType
      ? `${metadata.applicationType} ${metadata.applicationNumber}`
      : metadata.applicationNumber;
    drawer.drawLine('Application', appText);
  }
  if (metadata.therapeuticArea) {
    drawer.drawLine('Therapeutic Area', metadata.therapeuticArea);
  }

  drawer.drawLine('Submission', `${metadata.submissionType} (${metadata.sequenceNumber})`);
  drawer.drawLine('Date', formatDate(metadata.generatedAt));

  drawer.space(10);
  drawer.drawSeparator();
  drawer.space(20);

  // === Table of Contents ===
  drawer.drawHeading('TABLE OF CONTENTS');
  drawer.space(10);

  // Draw each TOC entry
  for (const entry of tocEntries) {
    // Check if we need a new page
    const entryHeight = fullConfig.fontSize.body * fullConfig.lineHeight;
    if (!drawer.hasSpace(entryHeight)) {
      // Add new page
      page = pdfDoc.addPage([fullConfig.pageWidth, fullConfig.pageHeight]);
      drawer = new TextDrawer(page, font, boldFont, fullConfig);
      drawer.drawHeading('TABLE OF CONTENTS (continued)');
      drawer.space(10);
    }

    // Calculate relative path for this entry
    const relativePath = calculateRelativePath(COVER_PAGE_PATH, entry.targetPath);

    // Draw entry with link
    drawer.drawTocEntry(entry, relativePath);
    linkCount++;
  }

  // === Add Bookmarks ===
  let bookmarkCount = 0;
  if (fullConfig.includeBookmarks && tocEntries.length > 0) {
    const bookmarks: BookmarkEntry[] = [
      {
        title: 'Cover Page',
        pageNumber: 1,
        children: [
          { title: 'Header', pageNumber: 1 },
          {
            title: 'Table of Contents',
            pageNumber: 1,
            children: tocToBookmarks(tocEntries),
          },
        ],
      },
    ];

    const bookmarkResult = await injectBookmarks(pdfDoc, bookmarks);
    bookmarkCount = bookmarkResult.bookmarkCount;

    if (bookmarkResult.warnings.length > 0) {
      warnings.push(...bookmarkResult.warnings);
    }
  }

  // Save PDF
  const pdfBytes = await pdfDoc.save();

  return {
    pdfBytes,
    targetPath: COVER_PAGE_PATH,
    linkCount,
    bookmarkCount,
    warnings,
  };
}

/**
 * Get the cover page target path constant
 */
export function getCoverPagePath(): string {
  return COVER_PAGE_PATH;
}
