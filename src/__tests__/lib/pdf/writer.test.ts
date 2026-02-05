/**
 * Tests for PDF Writer (main orchestration module)
 *
 * Tests the core processPdf function which handles in-memory PDF processing.
 * File I/O wrapper functions (loadPdf, savePdf, processPdfFile, etc.) are
 * tested indirectly through integration tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  processPdf,
  type PdfProcessingOptions,
} from '@/lib/pdf/writer';

describe('writer', () => {
  let pdfDoc: PDFDocument;

  beforeEach(async () => {
    // Create a simple PDF with 5 pages
    pdfDoc = await PDFDocument.create();
    for (let i = 0; i < 5; i++) {
      pdfDoc.addPage([612, 792]); // Letter size
    }
  });

  describe('processPdf', () => {
    it('should return success with no options', async () => {
      const result = await processPdf(pdfDoc);

      expect(result.success).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.bookmarkResult).toBeUndefined();
      expect(result.hyperlinkResult).toBeUndefined();
    });

    it('should process bookmarks when provided', async () => {
      const options: PdfProcessingOptions = {
        bookmarks: [
          { title: 'Introduction', pageNumber: 1 },
          { title: 'Methods', pageNumber: 2 },
        ],
      };

      const result = await processPdf(pdfDoc, options);

      expect(result.success).toBe(true);
      expect(result.bookmarkResult).toBeDefined();
      expect(result.bookmarkResult?.success).toBe(true);
      expect(result.bookmarkResult?.bookmarkCount).toBe(2);
    });

    it('should remove existing bookmarks when flag is set', async () => {
      // First add bookmarks
      await processPdf(pdfDoc, {
        bookmarks: [{ title: 'Test', pageNumber: 1 }],
      });

      // Then remove them
      const result = await processPdf(pdfDoc, {
        removeExistingBookmarks: true,
      });

      expect(result.success).toBe(true);
      expect(result.bookmarkResult).toBeDefined();
      expect(result.bookmarkResult?.bookmarkCount).toBe(0);
      expect(result.bookmarkResult?.warnings).toContain('Existing bookmarks removed');
    });

    it('should replace existing bookmarks when adding new ones', async () => {
      // First add bookmarks
      await processPdf(pdfDoc, {
        bookmarks: [{ title: 'Old Bookmark', pageNumber: 1 }],
      });

      // Then add new bookmarks
      const result = await processPdf(pdfDoc, {
        bookmarks: [
          { title: 'New Bookmark 1', pageNumber: 2 },
          { title: 'New Bookmark 2', pageNumber: 3 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Existing bookmarks were replaced');
      expect(result.bookmarkResult?.bookmarkCount).toBe(2);
    });

    it('should process hyperlinks when options provided', async () => {
      const options: PdfProcessingOptions = {
        processHyperlinks: true,
        hyperlinkOptions: {
          removeExternalLinks: true,
        },
      };

      const result = await processPdf(pdfDoc, options);

      expect(result.success).toBe(true);
      expect(result.hyperlinkResult).toBeDefined();
      expect(result.hyperlinkResult?.success).toBe(true);
    });

    it('should skip hyperlink processing when explicitly disabled', async () => {
      const options: PdfProcessingOptions = {
        processHyperlinks: false,
        hyperlinkOptions: {
          removeExternalLinks: true,
        },
      };

      const result = await processPdf(pdfDoc, options);

      expect(result.success).toBe(true);
      expect(result.hyperlinkResult).toBeUndefined();
    });

    it('should process both bookmarks and hyperlinks together', async () => {
      const options: PdfProcessingOptions = {
        bookmarks: [
          { title: 'Section 1', pageNumber: 1 },
          { title: 'Section 2', pageNumber: 2 },
        ],
        hyperlinkOptions: {
          basePath: '/documents',
        },
      };

      const result = await processPdf(pdfDoc, options);

      expect(result.success).toBe(true);
      expect(result.bookmarkResult).toBeDefined();
      expect(result.hyperlinkResult).toBeDefined();
    });

    it('should combine warnings from all operations', async () => {
      // Create PDF with invalid bookmark page
      const options: PdfProcessingOptions = {
        bookmarks: [
          { title: 'Valid', pageNumber: 1 },
          { title: 'Invalid', pageNumber: 100 },
        ],
        hyperlinkOptions: {},
      };

      const result = await processPdf(pdfDoc, options);

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle hierarchical bookmarks', async () => {
      const options: PdfProcessingOptions = {
        bookmarks: [
          {
            title: 'Module 5',
            pageNumber: 1,
            children: [
              {
                title: 'Section 16',
                pageNumber: 2,
                children: [
                  { title: '16.1 Protocol', pageNumber: 3 },
                  { title: '16.2 CRF', pageNumber: 4 },
                ],
              },
            ],
          },
        ],
      };

      const result = await processPdf(pdfDoc, options);

      expect(result.success).toBe(true);
      expect(result.bookmarkResult?.bookmarkCount).toBe(4);
      expect(result.bookmarkResult?.maxDepth).toBe(3);
    });

    it('should handle empty bookmark array', async () => {
      const options: PdfProcessingOptions = {
        bookmarks: [],
      };

      const result = await processPdf(pdfDoc, options);

      expect(result.success).toBe(true);
      expect(result.bookmarkResult).toBeUndefined();
    });

    it('should handle PDF with no pages gracefully', async () => {
      // Create empty PDF (no pages)
      const emptyPdf = await PDFDocument.create();

      const options: PdfProcessingOptions = {
        bookmarks: [{ title: 'Test', pageNumber: 1 }],
      };

      const result = await processPdf(emptyPdf, options);

      // processPdf succeeds but bookmarkResult indicates failure
      expect(result.success).toBe(true);
      expect(result.bookmarkResult).toBeDefined();
      expect(result.bookmarkResult?.success).toBe(false);
      expect(result.bookmarkResult?.error).toContain('no pages');
    });
  });

  describe('result structure', () => {
    it('should return properly structured result', async () => {
      const result = await processPdf(pdfDoc);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('warnings');
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should include error message in bookmarkResult on failure', async () => {
      const emptyPdf = await PDFDocument.create();

      const result = await processPdf(emptyPdf, {
        bookmarks: [{ title: 'Test', pageNumber: 1 }],
      });

      // Overall operation succeeds, but bookmark operation fails
      expect(result.success).toBe(true);
      expect(result.bookmarkResult?.success).toBe(false);
      expect(result.bookmarkResult?.error).toBeDefined();
      expect(typeof result.bookmarkResult?.error).toBe('string');
    });
  });

  describe('bookmark processing options', () => {
    it('should respect isOpen flag', async () => {
      const options: PdfProcessingOptions = {
        bookmarks: [
          {
            title: 'Collapsed',
            pageNumber: 1,
            isOpen: false,
            children: [
              { title: 'Child', pageNumber: 2 },
            ],
          },
        ],
      };

      const result = await processPdf(pdfDoc, options);

      expect(result.success).toBe(true);
      expect(result.bookmarkResult?.bookmarkCount).toBe(2);
    });
  });

  describe('hyperlink processing options', () => {
    it('should accept path map for link resolution', async () => {
      const pathMap = new Map<string, string>();
      pathMap.set('old.pdf', 'new.pdf');

      const options: PdfProcessingOptions = {
        hyperlinkOptions: {
          pathMap,
        },
      };

      const result = await processPdf(pdfDoc, options);

      expect(result.success).toBe(true);
      expect(result.hyperlinkResult).toBeDefined();
    });

    it('should accept base path for relative link calculation', async () => {
      const options: PdfProcessingOptions = {
        hyperlinkOptions: {
          basePath: '/documents/study-001/16-1',
        },
      };

      const result = await processPdf(pdfDoc, options);

      expect(result.success).toBe(true);
    });

    it('should accept mailto link removal option', async () => {
      const options: PdfProcessingOptions = {
        hyperlinkOptions: {
          removeMailtoLinks: true,
        },
      };

      const result = await processPdf(pdfDoc, options);

      expect(result.success).toBe(true);
    });
  });

  describe('eCTD compliance scenarios', () => {
    it('should handle typical eCTD Module 5 structure', async () => {
      const bookmarks: PdfProcessingOptions['bookmarks'] = [
        {
          title: 'Module 5: Clinical Study Reports',
          pageNumber: 1,
          children: [
            {
              title: '5.3 Clinical Study Reports',
              pageNumber: 1,
              children: [
                {
                  title: '5.3.5 Reports of Efficacy and Safety Studies',
                  pageNumber: 1,
                  children: [
                    { title: 'Study ABC-001', pageNumber: 2 },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const result = await processPdf(pdfDoc, { bookmarks });

      expect(result.success).toBe(true);
      expect(result.bookmarkResult?.maxDepth).toBe(4);
    });

    it('should handle section 16 appendix structure', async () => {
      const bookmarks: PdfProcessingOptions['bookmarks'] = [
        {
          title: 'Section 16: Appendices',
          pageNumber: 1,
          children: [
            { title: '16.1 Protocol and Amendments', pageNumber: 1 },
            { title: '16.2 Sample Case Report Form', pageNumber: 2 },
            { title: '16.3 IRB/IEC Documents', pageNumber: 3 },
            { title: '16.4 Sample Patient Materials', pageNumber: 4 },
          ],
        },
      ];

      const result = await processPdf(pdfDoc, { bookmarks });

      expect(result.success).toBe(true);
      expect(result.bookmarkResult?.bookmarkCount).toBe(5);
      expect(result.bookmarkResult?.maxDepth).toBe(2);
    });

    it('should process hyperlinks with eCTD path mapping', async () => {
      const pathMap = new Map<string, string>();
      pathMap.set('protocol-v1.pdf', 'm5/study-001/16-1/protocol-v1.pdf');
      pathMap.set('crf-blank.pdf', 'm5/study-001/16-2/crf-blank.pdf');

      const options: PdfProcessingOptions = {
        hyperlinkOptions: {
          pathMap,
          basePath: 'm5/study-001/16-1',
          removeExternalLinks: true,
        },
      };

      const result = await processPdf(pdfDoc, options);

      expect(result.success).toBe(true);
    });
  });
});
