import { describe, it, expect } from 'vitest';
import {
  classifyLink,
  validateCrossDocumentLink,
  exportReportAsCsv,
} from '@/lib/packaging/hyperlinks';
import type { ExtractedLink, HyperlinkReport } from '@/lib/packaging/hyperlinks';
import type { PackageManifest, PackageFile } from '@/lib/packaging/types';

describe('hyperlinks', () => {
  describe('classifyLink', () => {
    it('classifies http:// as external', () => {
      const link: ExtractedLink = {
        sourceFile: 'doc.pdf',
        pageNumber: 1,
        targetUri: 'http://example.com',
        linkType: 'unknown',
      };
      expect(classifyLink(link, 'doc.pdf')).toBe('external');
    });

    it('classifies https:// as external', () => {
      const link: ExtractedLink = {
        sourceFile: 'doc.pdf',
        pageNumber: 1,
        targetUri: 'https://example.com',
        linkType: 'unknown',
      };
      expect(classifyLink(link, 'doc.pdf')).toBe('external');
    });

    it('classifies mailto: as external', () => {
      const link: ExtractedLink = {
        sourceFile: 'doc.pdf',
        pageNumber: 1,
        targetUri: 'mailto:test@example.com',
        linkType: 'unknown',
      };
      expect(classifyLink(link, 'doc.pdf')).toBe('external');
    });

    it('classifies .pdf reference as cross-document', () => {
      const link: ExtractedLink = {
        sourceFile: 'doc.pdf',
        pageNumber: 1,
        targetUri: '../other/file.pdf',
        linkType: 'unknown',
      };
      expect(classifyLink(link, 'doc.pdf')).toBe('cross-document');
    });

    it('classifies .pdf#destination as cross-document', () => {
      const link: ExtractedLink = {
        sourceFile: 'doc.pdf',
        pageNumber: 1,
        targetUri: 'other.pdf#section1',
        linkType: 'unknown',
      };
      expect(classifyLink(link, 'doc.pdf')).toBe('cross-document');
    });

    it('classifies page destination as internal', () => {
      const link: ExtractedLink = {
        sourceFile: 'doc.pdf',
        pageNumber: 1,
        targetPage: 5,
        linkType: 'unknown',
      };
      expect(classifyLink(link, 'doc.pdf')).toBe('internal');
    });

    it('classifies named destination as internal', () => {
      const link: ExtractedLink = {
        sourceFile: 'doc.pdf',
        pageNumber: 1,
        targetDestination: 'chapter1',
        linkType: 'unknown',
      };
      expect(classifyLink(link, 'doc.pdf')).toBe('internal');
    });

    it('preserves already-classified internal links', () => {
      const link: ExtractedLink = {
        sourceFile: 'doc.pdf',
        pageNumber: 1,
        linkType: 'internal',
      };
      expect(classifyLink(link, 'doc.pdf')).toBe('internal');
    });

    it('preserves already-classified cross-document links', () => {
      const link: ExtractedLink = {
        sourceFile: 'doc.pdf',
        pageNumber: 1,
        linkType: 'cross-document',
      };
      expect(classifyLink(link, 'doc.pdf')).toBe('cross-document');
    });
  });

  describe('validateCrossDocumentLink', () => {
    const createManifest = (files: Partial<PackageFile>[]): PackageManifest => ({
      studyId: 'study-1',
      studyNumber: 'STUDY-001',
      generatedAt: new Date(),
      files: files.map((f, i) => ({
        sourceDocumentId: `doc-${i}`,
        sourcePath: f.sourcePath || '/uploads/doc.pdf',
        targetPath: f.targetPath || 'm5/study-001/16-1/doc.pdf',
        nodeCode: f.nodeCode || '16.1',
        nodeTitle: f.nodeTitle || 'Section',
        fileName: f.fileName || 'doc.pdf',
        version: 1,
        fileSize: 1000,
      })),
      readiness: {
        ready: true,
        missingRequired: [],
        pendingApproval: [],
        validationErrors: 0,
        unresolvedAnnotations: 0,
        totalFiles: files.length,
        totalRequiredNodes: 0,
      },
      folderStructure: [],
    });

    it('validates link when target file exists by name', () => {
      const manifest = createManifest([
        { fileName: 'target.pdf', targetPath: 'm5/study-001/16-2/target.pdf' },
      ]);

      const link: ExtractedLink = {
        sourceFile: 'source.pdf',
        pageNumber: 1,
        targetUri: 'target.pdf',
        linkType: 'cross-document',
      };

      const result = validateCrossDocumentLink(link, manifest);
      expect(result.isValid).toBe(true);
      expect(result.resolvedPath).toBe('m5/study-001/16-2/target.pdf');
    });

    it('fails when target file does not exist', () => {
      const manifest = createManifest([
        { fileName: 'other.pdf', targetPath: 'm5/study-001/16-1/other.pdf' },
      ]);

      const link: ExtractedLink = {
        sourceFile: 'source.pdf',
        pageNumber: 1,
        targetUri: 'missing.pdf',
        linkType: 'cross-document',
      };

      const result = validateCrossDocumentLink(link, manifest);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('fails when link has no target URI', () => {
      const manifest = createManifest([]);

      const link: ExtractedLink = {
        sourceFile: 'source.pdf',
        pageNumber: 1,
        linkType: 'cross-document',
      };

      const result = validateCrossDocumentLink(link, manifest);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('no target URI');
    });
  });

  describe('exportReportAsCsv', () => {
    it('generates CSV with headers', () => {
      const report: HyperlinkReport = {
        totalLinks: 0,
        byType: { internal: 0, crossDocument: 0, external: 0, unknown: 0 },
        brokenLinks: [],
        externalLinks: [],
        validatedAt: new Date('2026-01-30T12:00:00Z'),
        warnings: [],
      };

      const csv = exportReportAsCsv(report);
      expect(csv).toContain('Source File,Page,Link Type,Target,Status,Error');
    });

    it('includes broken links in CSV', () => {
      const report: HyperlinkReport = {
        totalLinks: 1,
        byType: { internal: 0, crossDocument: 1, external: 0, unknown: 0 },
        brokenLinks: [
          {
            link: {
              sourceFile: 'doc.pdf',
              pageNumber: 5,
              targetUri: 'missing.pdf',
              linkType: 'cross-document',
            },
            isValid: false,
            error: 'Target file not found',
          },
        ],
        externalLinks: [],
        validatedAt: new Date(),
        warnings: [],
      };

      const csv = exportReportAsCsv(report);
      expect(csv).toContain('doc.pdf');
      expect(csv).toContain('5');
      expect(csv).toContain('BROKEN');
    });

    it('includes external links as flagged', () => {
      const report: HyperlinkReport = {
        totalLinks: 1,
        byType: { internal: 0, crossDocument: 0, external: 1, unknown: 0 },
        brokenLinks: [],
        externalLinks: [
          {
            sourceFile: 'doc.pdf',
            pageNumber: 3,
            targetUri: 'https://example.com',
            linkType: 'external',
          },
        ],
        validatedAt: new Date(),
        warnings: [],
      };

      const csv = exportReportAsCsv(report);
      expect(csv).toContain('FLAGGED');
      expect(csv).toContain('https://example.com');
    });

    it('includes summary section', () => {
      const report: HyperlinkReport = {
        totalLinks: 10,
        byType: { internal: 5, crossDocument: 3, external: 2, unknown: 0 },
        brokenLinks: [],
        externalLinks: [],
        validatedAt: new Date(),
        warnings: [],
      };

      const csv = exportReportAsCsv(report);
      expect(csv).toContain('Total Links,10');
      expect(csv).toContain('Internal Links,5');
      expect(csv).toContain('Cross-Document Links,3');
    });
  });
});
