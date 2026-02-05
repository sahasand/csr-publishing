/**
 * Tests for PDF Bookmark Writer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  injectBookmarks,
  removeBookmarks,
  hasBookmarks,
  countBookmarkEntries,
  calculateBookmarkDepth,
  type BookmarkEntry,
} from '@/lib/pdf/bookmark-writer';

describe('bookmark-writer', () => {
  let pdfDoc: PDFDocument;

  beforeEach(async () => {
    // Create a simple PDF with 5 pages
    pdfDoc = await PDFDocument.create();
    for (let i = 0; i < 5; i++) {
      pdfDoc.addPage([612, 792]); // Letter size
    }
  });

  describe('injectBookmarks', () => {
    it('should inject flat bookmarks', async () => {
      const bookmarks: BookmarkEntry[] = [
        { title: 'Introduction', pageNumber: 1 },
        { title: 'Methods', pageNumber: 2 },
        { title: 'Results', pageNumber: 3 },
      ];

      const result = await injectBookmarks(pdfDoc, bookmarks);

      expect(result.success).toBe(true);
      expect(result.bookmarkCount).toBe(3);
      expect(result.maxDepth).toBe(1);
      expect(result.warnings).toHaveLength(0);
    });

    it('should inject hierarchical bookmarks', async () => {
      const bookmarks: BookmarkEntry[] = [
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
      ];

      const result = await injectBookmarks(pdfDoc, bookmarks);

      expect(result.success).toBe(true);
      expect(result.bookmarkCount).toBe(4); // 1 + 1 + 2
      expect(result.maxDepth).toBe(3);
    });

    it('should handle empty bookmark array', async () => {
      const result = await injectBookmarks(pdfDoc, []);

      expect(result.success).toBe(true);
      expect(result.bookmarkCount).toBe(0);
      expect(result.warnings).toContain('No bookmarks to inject');
    });

    it('should warn about invalid page numbers', async () => {
      const bookmarks: BookmarkEntry[] = [
        { title: 'Valid', pageNumber: 1 },
        { title: 'Invalid High', pageNumber: 100 },
        { title: 'Invalid Zero', pageNumber: 0 },
      ];

      const result = await injectBookmarks(pdfDoc, bookmarks);

      expect(result.success).toBe(true);
      expect(result.bookmarkCount).toBe(1);
      expect(result.warnings.length).toBe(2);
      expect(result.warnings[0]).toContain('page 100');
      expect(result.warnings[1]).toContain('page 0');
    });

    it('should handle deeply nested bookmarks', async () => {
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
                        { title: 'Level 5', pageNumber: 5 },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const result = await injectBookmarks(pdfDoc, bookmarks);

      expect(result.success).toBe(true);
      expect(result.maxDepth).toBe(5);
    });

    it('should handle unicode titles', async () => {
      const bookmarks: BookmarkEntry[] = [
        { title: '日本語タイトル', pageNumber: 1 },
        { title: 'Título español', pageNumber: 2 },
        { title: 'Τίτλος Ελληνικά', pageNumber: 3 },
      ];

      const result = await injectBookmarks(pdfDoc, bookmarks);

      expect(result.success).toBe(true);
      expect(result.bookmarkCount).toBe(3);
    });

    it('should respect isOpen flag for collapsed bookmarks', async () => {
      const bookmarks: BookmarkEntry[] = [
        {
          title: 'Collapsed Section',
          pageNumber: 1,
          isOpen: false,
          children: [
            { title: 'Child 1', pageNumber: 2 },
            { title: 'Child 2', pageNumber: 3 },
          ],
        },
      ];

      const result = await injectBookmarks(pdfDoc, bookmarks);

      expect(result.success).toBe(true);
      expect(result.bookmarkCount).toBe(3);
    });

    it('should handle PDF with no pages', async () => {
      const emptyPdf = await PDFDocument.create();
      const bookmarks: BookmarkEntry[] = [
        { title: 'Test', pageNumber: 1 },
      ];

      const result = await injectBookmarks(emptyPdf, bookmarks);

      expect(result.success).toBe(false);
      expect(result.error).toContain('no pages');
    });
  });

  describe('hasBookmarks', () => {
    it('should return false for PDF without bookmarks', () => {
      expect(hasBookmarks(pdfDoc)).toBe(false);
    });

    it('should return true after injecting bookmarks', async () => {
      await injectBookmarks(pdfDoc, [{ title: 'Test', pageNumber: 1 }]);
      expect(hasBookmarks(pdfDoc)).toBe(true);
    });
  });

  describe('removeBookmarks', () => {
    it('should remove existing bookmarks', async () => {
      await injectBookmarks(pdfDoc, [{ title: 'Test', pageNumber: 1 }]);
      expect(hasBookmarks(pdfDoc)).toBe(true);

      removeBookmarks(pdfDoc);
      expect(hasBookmarks(pdfDoc)).toBe(false);
    });

    it('should handle PDF without bookmarks gracefully', () => {
      expect(() => removeBookmarks(pdfDoc)).not.toThrow();
    });
  });

  describe('countBookmarkEntries', () => {
    it('should count flat bookmarks', () => {
      const bookmarks: BookmarkEntry[] = [
        { title: 'A', pageNumber: 1 },
        { title: 'B', pageNumber: 2 },
        { title: 'C', pageNumber: 3 },
      ];

      expect(countBookmarkEntries(bookmarks)).toBe(3);
    });

    it('should count nested bookmarks recursively', () => {
      const bookmarks: BookmarkEntry[] = [
        {
          title: 'Root',
          pageNumber: 1,
          children: [
            { title: 'Child 1', pageNumber: 2 },
            {
              title: 'Child 2',
              pageNumber: 3,
              children: [
                { title: 'Grandchild', pageNumber: 4 },
              ],
            },
          ],
        },
      ];

      expect(countBookmarkEntries(bookmarks)).toBe(4);
    });

    it('should return 0 for empty array', () => {
      expect(countBookmarkEntries([])).toBe(0);
    });
  });

  describe('calculateBookmarkDepth', () => {
    it('should return 1 for flat bookmarks', () => {
      const bookmarks: BookmarkEntry[] = [
        { title: 'A', pageNumber: 1 },
        { title: 'B', pageNumber: 2 },
      ];

      expect(calculateBookmarkDepth(bookmarks)).toBe(1);
    });

    it('should return correct depth for nested bookmarks', () => {
      const bookmarks: BookmarkEntry[] = [
        {
          title: 'L1',
          pageNumber: 1,
          children: [
            {
              title: 'L2',
              pageNumber: 2,
              children: [
                { title: 'L3', pageNumber: 3 },
              ],
            },
          ],
        },
      ];

      expect(calculateBookmarkDepth(bookmarks)).toBe(3);
    });

    it('should return 0 for empty array', () => {
      expect(calculateBookmarkDepth([])).toBe(0);
    });

    it('should find max depth across multiple branches', () => {
      const bookmarks: BookmarkEntry[] = [
        { title: 'Shallow', pageNumber: 1 },
        {
          title: 'Deep',
          pageNumber: 2,
          children: [
            {
              title: 'Deeper',
              pageNumber: 3,
              children: [
                { title: 'Deepest', pageNumber: 4 },
              ],
            },
          ],
        },
      ];

      expect(calculateBookmarkDepth(bookmarks)).toBe(3);
    });
  });
});
