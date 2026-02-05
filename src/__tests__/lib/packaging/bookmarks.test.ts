import { describe, it, expect } from 'vitest';
import {
  truncateTitle,
  enforceMaxDepth,
  buildSectionBookmarks,
  calculateMaxDepth,
  countBookmarks,
  DEFAULT_BOOKMARK_CONFIG,
} from '@/lib/packaging/bookmarks';
import type { BookmarkNode, BookmarkConfig } from '@/lib/packaging/bookmarks';
import type { PackageFile } from '@/lib/packaging/types';

describe('bookmarks', () => {
  describe('truncateTitle', () => {
    it('returns short titles unchanged', () => {
      expect(truncateTitle('Short Title')).toBe('Short Title');
    });

    it('truncates long titles with suffix', () => {
      const longTitle = 'A'.repeat(150);
      const result = truncateTitle(longTitle);
      expect(result.length).toBe(DEFAULT_BOOKMARK_CONFIG.maxTitleLength);
      expect(result.endsWith('...')).toBe(true);
    });

    it('respects custom config', () => {
      const config: BookmarkConfig = {
        maxDepth: 4,
        maxTitleLength: 20,
        truncationSuffix: '…',
      };
      const result = truncateTitle('This is a very long title', config);
      expect(result.length).toBe(20);
      expect(result.endsWith('…')).toBe(true);
    });
  });

  describe('enforceMaxDepth', () => {
    it('returns bookmarks unchanged if within depth limit', () => {
      const bookmarks: BookmarkNode[] = [
        { title: 'Root', children: [], level: 1 },
      ];
      const result = enforceMaxDepth(bookmarks, 4, 1);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Root');
    });

    it('flattens bookmarks beyond max depth', () => {
      const bookmarks: BookmarkNode[] = [
        {
          title: 'Level 4',
          level: 4,
          children: [
            {
              title: 'Level 5 - Should Flatten',
              level: 5,
              children: [],
            },
          ],
        },
      ];

      const result = enforceMaxDepth(bookmarks, 4, 4);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Level 4');
      expect(result[0].children).toHaveLength(0);
      expect(result[1].title).toBe('Level 5 - Should Flatten');
    });

    it('recursively processes nested children', () => {
      const bookmarks: BookmarkNode[] = [
        {
          title: 'L1',
          level: 1,
          children: [
            {
              title: 'L2',
              level: 2,
              children: [
                { title: 'L3', level: 3, children: [] },
              ],
            },
          ],
        },
      ];

      const result = enforceMaxDepth(bookmarks, 4, 1);
      expect(result[0].children[0].children[0].title).toBe('L3');
    });
  });

  describe('buildSectionBookmarks', () => {
    const createFile = (code: string, title: string): PackageFile => ({
      sourceDocumentId: `doc-${code}`,
      sourcePath: `/uploads/${code}.pdf`,
      targetPath: `m5/study/${code.replace(/\./g, '-')}/doc.pdf`,
      nodeCode: code,
      nodeTitle: title,
      fileName: 'doc.pdf',
      version: 1,
      fileSize: 1000,
    });

    it('creates bookmarks from files', () => {
      const files = [
        createFile('16.1', 'Study Information'),
        createFile('16.2', 'Patient Listings'),
      ];

      const result = buildSectionBookmarks(files);

      // Parent section 16 is auto-created, with 16.1 and 16.2 as children
      expect(result).toHaveLength(1);
      expect(result[0].title).toContain('16');
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children[0].title).toContain('16.1');
      expect(result[0].children[0].title).toContain('Study Information');
    });

    it('builds hierarchical structure', () => {
      const files = [
        createFile('16', 'Module 16'),
        createFile('16.1', 'Study Information'),
        createFile('16.2', 'Patient Listings'),
        createFile('16.2.1', 'Demographics'),
      ];

      const result = buildSectionBookmarks(files);

      expect(result).toHaveLength(1);
      expect(result[0].title).toContain('16 -');
      expect(result[0].children).toHaveLength(2);

      const section16_2 = result[0].children.find(c => c.title.includes('16.2 -'));
      expect(section16_2?.children).toHaveLength(1);
      expect(section16_2?.children[0].title).toContain('16.2.1');
    });

    it('returns empty array for no files', () => {
      expect(buildSectionBookmarks([])).toEqual([]);
    });

    it('sorts sections by code numerically', () => {
      const files = [
        createFile('16.10', 'Section 10'),
        createFile('16.2', 'Section 2'),
        createFile('16.1', 'Section 1'),
      ];

      const result = buildSectionBookmarks(files);
      const titles = result[0]?.children.map(c => c.title) || [];

      expect(titles[0]).toContain('16.1');
      expect(titles[1]).toContain('16.2');
      expect(titles[2]).toContain('16.10');
    });
  });

  describe('calculateMaxDepth', () => {
    it('returns 0 for empty bookmarks', () => {
      expect(calculateMaxDepth([])).toBe(0);
    });

    it('returns level of single bookmark', () => {
      const bookmarks: BookmarkNode[] = [
        { title: 'Test', level: 2, children: [] },
      ];
      expect(calculateMaxDepth(bookmarks)).toBe(2);
    });

    it('finds deepest nested level', () => {
      const bookmarks: BookmarkNode[] = [
        {
          title: 'L1',
          level: 1,
          children: [
            {
              title: 'L2',
              level: 2,
              children: [
                { title: 'L3', level: 3, children: [] },
              ],
            },
          ],
        },
      ];
      expect(calculateMaxDepth(bookmarks)).toBe(3);
    });
  });

  describe('countBookmarks', () => {
    it('returns 0 for empty bookmarks', () => {
      expect(countBookmarks([])).toBe(0);
    });

    it('counts single bookmark', () => {
      const bookmarks: BookmarkNode[] = [
        { title: 'Test', level: 1, children: [] },
      ];
      expect(countBookmarks(bookmarks)).toBe(1);
    });

    it('counts nested bookmarks', () => {
      const bookmarks: BookmarkNode[] = [
        {
          title: 'Parent',
          level: 1,
          children: [
            { title: 'Child 1', level: 2, children: [] },
            { title: 'Child 2', level: 2, children: [] },
          ],
        },
      ];
      expect(countBookmarks(bookmarks)).toBe(3);
    });
  });
});
