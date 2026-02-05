import { describe, it, expect } from 'vitest';
import {
  codeToFolderPath,
  sanitizePathComponent,
  sanitizeFileName,
  buildFolderTree,
  getTargetPath,
  parseTargetPath,
} from '@/lib/packaging/folder-structure';
import type { PackageFile } from '@/lib/packaging/types';

describe('folder-structure', () => {
  describe('codeToFolderPath', () => {
    it('converts simple code to folder path', () => {
      expect(codeToFolderPath('16', 'STUDY-001')).toBe('m5/study-001/16');
    });

    it('converts dotted code to hyphenated path', () => {
      expect(codeToFolderPath('16.2.1', 'STUDY-001')).toBe('m5/study-001/16-2-1');
    });

    it('sanitizes study number with spaces', () => {
      expect(codeToFolderPath('16.1', 'My Study 123')).toBe('m5/my-study-123/16-1');
    });

    it('handles special characters in study number', () => {
      expect(codeToFolderPath('16', 'ONCO-2025/001')).toBe('m5/onco-2025001/16');
    });
  });

  describe('sanitizePathComponent', () => {
    it('converts to lowercase', () => {
      expect(sanitizePathComponent('HELLO')).toBe('hello');
    });

    it('replaces spaces with hyphens', () => {
      expect(sanitizePathComponent('hello world')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(sanitizePathComponent('hello@world!')).toBe('helloworld');
    });

    it('collapses multiple hyphens', () => {
      expect(sanitizePathComponent('hello---world')).toBe('hello-world');
    });

    it('trims leading and trailing hyphens', () => {
      expect(sanitizePathComponent('-hello-')).toBe('hello');
    });

    it('handles empty string', () => {
      expect(sanitizePathComponent('')).toBe('');
    });
  });

  describe('sanitizeFileName', () => {
    it('sanitizes file name with extension', () => {
      expect(sanitizeFileName('My Document.pdf')).toBe('my-document.pdf');
    });

    it('handles special characters', () => {
      expect(sanitizeFileName('Report (Final) v2.pdf')).toBe('report-final-v2.pdf');
    });

    it('preserves extension case as lowercase', () => {
      expect(sanitizeFileName('file.PDF')).toBe('file.pdf');
    });

    it('handles file without extension', () => {
      expect(sanitizeFileName('README')).toBe('readme');
    });

    it('truncates long file names', () => {
      const longName = 'a'.repeat(60) + '.pdf';
      const result = sanitizeFileName(longName);
      // Max name length is 50 + extension (.pdf = 4 chars) = 54 total max
      expect(result.length).toBeLessThanOrEqual(54);
      expect(result).toBe('a'.repeat(50) + '.pdf');
    });

    it('returns document for empty name', () => {
      // Empty string name results in "document" default
      expect(sanitizeFileName('')).toBe('document');
    });

    it('handles dotfile without extension', () => {
      // When file name is only ".pdf", lastDotIndex is 0 (not > 0)
      // So implementation treats whole string as name with no extension
      // After sanitization, the dot is removed leaving "pdf"
      expect(sanitizeFileName('.pdf')).toBe('pdf');
    });
  });

  describe('buildFolderTree', () => {
    it('builds tree from single file', () => {
      const files: PackageFile[] = [
        {
          sourceDocumentId: '1',
          sourcePath: '/uploads/doc.pdf',
          targetPath: 'm5/study-001/16-1/document.pdf',
          nodeCode: '16.1',
          nodeTitle: 'Study Info',
          fileName: 'document.pdf',
          version: 1,
          fileSize: 1000,
        },
      ];

      const tree = buildFolderTree(files);

      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('m5');
      expect(tree[0].children[0].name).toBe('study-001');
      expect(tree[0].children[0].children[0].name).toBe('16-1');
      expect(tree[0].children[0].children[0].files).toContain('document.pdf');
    });

    it('groups files in same folder', () => {
      const files: PackageFile[] = [
        {
          sourceDocumentId: '1',
          sourcePath: '/uploads/doc1.pdf',
          targetPath: 'm5/study-001/16-1/doc1.pdf',
          nodeCode: '16.1',
          nodeTitle: 'Study Info',
          fileName: 'doc1.pdf',
          version: 1,
          fileSize: 1000,
        },
        {
          sourceDocumentId: '2',
          sourcePath: '/uploads/doc2.pdf',
          targetPath: 'm5/study-001/16-1/doc2.pdf',
          nodeCode: '16.1',
          nodeTitle: 'Study Info',
          fileName: 'doc2.pdf',
          version: 1,
          fileSize: 1000,
        },
      ];

      const tree = buildFolderTree(files);
      const folder = tree[0].children[0].children[0];

      expect(folder.files).toHaveLength(2);
      expect(folder.files).toContain('doc1.pdf');
      expect(folder.files).toContain('doc2.pdf');
    });

    it('returns empty array for no files', () => {
      expect(buildFolderTree([])).toEqual([]);
    });
  });

  describe('getTargetPath', () => {
    it('combines folder path and sanitized file name', () => {
      const result = getTargetPath('16.2.1', 'STUDY-001', 'My Report.pdf');
      expect(result).toBe('m5/study-001/16-2-1/my-report.pdf');
    });
  });

  describe('parseTargetPath', () => {
    it('parses path into folder and file', () => {
      const result = parseTargetPath('m5/study-001/16-1/document.pdf');
      expect(result.folderPath).toBe('m5/study-001/16-1');
      expect(result.fileName).toBe('document.pdf');
    });

    it('handles path with no folder', () => {
      const result = parseTargetPath('document.pdf');
      expect(result.folderPath).toBe('');
      expect(result.fileName).toBe('document.pdf');
    });
  });
});
