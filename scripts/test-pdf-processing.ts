/**
 * Manual test script for PDF processing functionality
 *
 * Run with: npx tsx scripts/test-pdf-processing.ts
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  processPdf,
  injectBookmarks,
  hasBookmarks,
  countBookmarkEntries,
  calculateBookmarkDepth,
  type BookmarkEntry,
  type PdfProcessingOptions,
} from '../src/lib/pdf';

const OUTPUT_DIR = './test-output';

async function createTestPdf(): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Create 10 pages with content
  const pageContents = [
    'Cover Page - Clinical Study Report',
    'Table of Contents',
    'Synopsis',
    'Introduction',
    'Study Objectives',
    'Methodology',
    'Results',
    'Discussion',
    'Conclusions',
    'Appendices',
  ];

  for (let i = 0; i < pageContents.length; i++) {
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();

    // Add page title
    page.drawText(pageContents[i], {
      x: 50,
      y: height - 100,
      size: 24,
      font: boldFont,
      color: rgb(0, 0, 0.5),
    });

    // Add page number
    page.drawText(`Page ${i + 1}`, {
      x: width - 80,
      y: 30,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Add some body text
    page.drawText(`This is the content for ${pageContents[i]}.`, {
      x: 50,
      y: height - 150,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });

    page.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit.', {
      x: 50,
      y: height - 180,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
  }

  return pdfDoc;
}

async function testBookmarkInjection() {
  console.log('\n=== Test 1: Bookmark Injection ===\n');

  const pdfDoc = await createTestPdf();

  // Define hierarchical bookmarks matching the page structure
  const bookmarks: BookmarkEntry[] = [
    { title: 'Cover Page', pageNumber: 1 },
    { title: 'Table of Contents', pageNumber: 2 },
    {
      title: 'Main Report',
      pageNumber: 3,
      children: [
        { title: 'Synopsis', pageNumber: 3 },
        { title: 'Introduction', pageNumber: 4 },
        { title: 'Study Objectives', pageNumber: 5 },
        {
          title: 'Study Conduct',
          pageNumber: 6,
          children: [
            { title: 'Methodology', pageNumber: 6 },
            { title: 'Results', pageNumber: 7 },
          ],
        },
        { title: 'Discussion', pageNumber: 8 },
        { title: 'Conclusions', pageNumber: 9 },
      ],
    },
    { title: 'Appendices', pageNumber: 10 },
  ];

  console.log('Bookmark structure:');
  console.log(`  Total entries: ${countBookmarkEntries(bookmarks)}`);
  console.log(`  Max depth: ${calculateBookmarkDepth(bookmarks)}`);
  console.log(`  Has bookmarks before: ${hasBookmarks(pdfDoc)}`);

  const result = await injectBookmarks(pdfDoc, bookmarks);

  console.log('\nInjection result:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Bookmark count: ${result.bookmarkCount}`);
  console.log(`  Max depth: ${result.maxDepth}`);
  console.log(`  Warnings: ${result.warnings.length}`);
  if (result.warnings.length > 0) {
    result.warnings.forEach((w) => console.log(`    - ${w}`));
  }
  console.log(`  Has bookmarks after: ${hasBookmarks(pdfDoc)}`);

  // Save the PDF
  const outputPath = join(OUTPUT_DIR, 'test-bookmarks.pdf');
  const pdfBytes = await pdfDoc.save();
  await writeFile(outputPath, pdfBytes);
  console.log(`\nSaved to: ${outputPath}`);

  return result.success;
}

async function testCombinedProcessing() {
  console.log('\n=== Test 2: Combined Processing (Bookmarks + Hyperlinks) ===\n');

  const pdfDoc = await createTestPdf();

  const options: PdfProcessingOptions = {
    bookmarks: [
      {
        title: 'Clinical Study Report',
        pageNumber: 1,
        children: [
          { title: 'Front Matter', pageNumber: 1 },
          { title: 'Synopsis', pageNumber: 3 },
          {
            title: 'Body',
            pageNumber: 4,
            children: [
              { title: 'Introduction', pageNumber: 4 },
              { title: 'Methods', pageNumber: 6 },
              { title: 'Results', pageNumber: 7 },
              { title: 'Discussion', pageNumber: 8 },
            ],
          },
          { title: 'Appendices', pageNumber: 10 },
        ],
      },
    ],
    hyperlinkOptions: {
      removeExternalLinks: false, // Just flag them, don't remove
      basePath: 'm5/study-001/csr',
    },
  };

  console.log('Processing options:');
  console.log(`  Bookmarks: ${countBookmarkEntries(options.bookmarks!)} entries`);
  console.log(`  Hyperlink base path: ${options.hyperlinkOptions?.basePath}`);
  console.log(`  Remove external links: ${options.hyperlinkOptions?.removeExternalLinks}`);

  const result = await processPdf(pdfDoc, options);

  console.log('\nProcessing result:');
  console.log(`  Overall success: ${result.success}`);

  if (result.bookmarkResult) {
    console.log('\n  Bookmark processing:');
    console.log(`    Success: ${result.bookmarkResult.success}`);
    console.log(`    Count: ${result.bookmarkResult.bookmarkCount}`);
    console.log(`    Max depth: ${result.bookmarkResult.maxDepth}`);
  }

  if (result.hyperlinkResult) {
    console.log('\n  Hyperlink processing:');
    console.log(`    Success: ${result.hyperlinkResult.success}`);
    console.log(`    Total links: ${result.hyperlinkResult.totalLinks}`);
    console.log(`    Updated: ${result.hyperlinkResult.updatedCount}`);
    console.log(`    Removed: ${result.hyperlinkResult.removedCount}`);
    console.log(`    Kept: ${result.hyperlinkResult.keptCount}`);
  }

  if (result.warnings.length > 0) {
    console.log('\n  Warnings:');
    result.warnings.forEach((w) => console.log(`    - ${w}`));
  }

  // Save the PDF
  const outputPath = join(OUTPUT_DIR, 'test-combined.pdf');
  const pdfBytes = await pdfDoc.save();
  await writeFile(outputPath, pdfBytes);
  console.log(`\nSaved to: ${outputPath}`);

  return result.success;
}

async function testInvalidBookmarks() {
  console.log('\n=== Test 3: Invalid Bookmark Handling ===\n');

  const pdfDoc = await createTestPdf(); // 10 pages

  const bookmarks: BookmarkEntry[] = [
    { title: 'Valid - Page 1', pageNumber: 1 },
    { title: 'Valid - Page 5', pageNumber: 5 },
    { title: 'Invalid - Page 0', pageNumber: 0 }, // Invalid
    { title: 'Invalid - Page 100', pageNumber: 100 }, // Invalid
    { title: 'Valid - Page 10', pageNumber: 10 },
  ];

  console.log('Testing with invalid page numbers (0 and 100 on 10-page PDF)...');

  const result = await injectBookmarks(pdfDoc, bookmarks);

  console.log('\nResult:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Valid bookmarks added: ${result.bookmarkCount}`);
  console.log(`  Warnings: ${result.warnings.length}`);
  result.warnings.forEach((w) => console.log(`    - ${w}`));

  // Save the PDF
  const outputPath = join(OUTPUT_DIR, 'test-invalid-bookmarks.pdf');
  const pdfBytes = await pdfDoc.save();
  await writeFile(outputPath, pdfBytes);
  console.log(`\nSaved to: ${outputPath}`);

  return result.success && result.bookmarkCount === 3;
}

async function testDeepHierarchy() {
  console.log('\n=== Test 4: Deep Bookmark Hierarchy ===\n');

  const pdfDoc = await createTestPdf();

  // Create a 5-level deep hierarchy
  const bookmarks: BookmarkEntry[] = [
    {
      title: 'Level 1',
      pageNumber: 1,
      children: [
        {
          title: 'Level 2',
          pageNumber: 2,
          children: [
            {
              title: 'Level 3',
              pageNumber: 3,
              children: [
                {
                  title: 'Level 4',
                  pageNumber: 4,
                  children: [
                    { title: 'Level 5 - Item A', pageNumber: 5 },
                    { title: 'Level 5 - Item B', pageNumber: 6 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  console.log(`Testing ${calculateBookmarkDepth(bookmarks)}-level deep hierarchy...`);

  const result = await injectBookmarks(pdfDoc, bookmarks);

  console.log('\nResult:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Bookmark count: ${result.bookmarkCount}`);
  console.log(`  Max depth: ${result.maxDepth}`);

  // Save the PDF
  const outputPath = join(OUTPUT_DIR, 'test-deep-hierarchy.pdf');
  const pdfBytes = await pdfDoc.save();
  await writeFile(outputPath, pdfBytes);
  console.log(`\nSaved to: ${outputPath}`);

  return result.success && result.maxDepth === 5;
}

async function main() {
  console.log('PDF Processing Test Suite');
  console.log('=========================');

  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });

  const results: { name: string; passed: boolean }[] = [];

  try {
    results.push({
      name: 'Bookmark Injection',
      passed: await testBookmarkInjection(),
    });

    results.push({
      name: 'Combined Processing',
      passed: await testCombinedProcessing(),
    });

    results.push({
      name: 'Invalid Bookmark Handling',
      passed: await testInvalidBookmarks(),
    });

    results.push({
      name: 'Deep Hierarchy',
      passed: await testDeepHierarchy(),
    });
  } catch (error) {
    console.error('\nTest error:', error);
  }

  // Summary
  console.log('\n\n=== Test Summary ===\n');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((r) => {
    console.log(`  ${r.passed ? '✓' : '✗'} ${r.name}`);
  });

  console.log(`\n  ${passed}/${total} tests passed`);
  console.log(`\n  Output files saved to: ${OUTPUT_DIR}/`);
  console.log('  Open the PDFs in a PDF viewer to verify bookmarks work correctly.');
}

main().catch(console.error);
