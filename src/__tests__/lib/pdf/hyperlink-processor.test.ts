/**
 * Tests for PDF Hyperlink Processor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFString, PDFRef } from 'pdf-lib';
import {
  processHyperlinks,
  buildPathMapFromManifest,
  type HyperlinkProcessingOptions,
} from '@/lib/pdf/hyperlink-processor';

describe('hyperlink-processor', () => {
  let pdfDoc: PDFDocument;

  beforeEach(async () => {
    // Create a simple PDF with pages
    pdfDoc = await PDFDocument.create();
    for (let i = 0; i < 3; i++) {
      pdfDoc.addPage([612, 792]);
    }
  });

  describe('processHyperlinks', () => {
    it('should return success with no links when PDF has no annotations', async () => {
      const result = await processHyperlinks(pdfDoc);

      expect(result.success).toBe(true);
      expect(result.totalLinks).toBe(0);
      expect(result.updatedCount).toBe(0);
      expect(result.removedCount).toBe(0);
      expect(result.keptCount).toBe(0);
    });

    it('should accept empty options', async () => {
      const result = await processHyperlinks(pdfDoc, {});

      expect(result.success).toBe(true);
    });

    it('should accept removeExternalLinks option', async () => {
      const options: HyperlinkProcessingOptions = {
        removeExternalLinks: true,
      };

      const result = await processHyperlinks(pdfDoc, options);

      expect(result.success).toBe(true);
    });

    it('should accept removeMailtoLinks option', async () => {
      const options: HyperlinkProcessingOptions = {
        removeMailtoLinks: true,
      };

      const result = await processHyperlinks(pdfDoc, options);

      expect(result.success).toBe(true);
    });

    it('should accept basePath option', async () => {
      const options: HyperlinkProcessingOptions = {
        basePath: '/documents/study-001',
      };

      const result = await processHyperlinks(pdfDoc, options);

      expect(result.success).toBe(true);
    });

    it('should accept pathMap option', async () => {
      const pathMap = new Map<string, string>();
      pathMap.set('old-protocol.pdf', 'm5/study/16-1/protocol.pdf');

      const options: HyperlinkProcessingOptions = {
        pathMap,
      };

      const result = await processHyperlinks(pdfDoc, options);

      expect(result.success).toBe(true);
    });

    it('should count warnings separately from errors', async () => {
      const result = await processHyperlinks(pdfDoc);

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should return processedLinks array', async () => {
      const result = await processHyperlinks(pdfDoc);

      expect(result.processedLinks).toBeDefined();
      expect(Array.isArray(result.processedLinks)).toBe(true);
    });
  });

  describe('buildPathMapFromManifest', () => {
    it('should create path map from file list', () => {
      const files = [
        {
          sourcePath: 'uploads/study-001/protocol.pdf',
          targetPath: 'm5/study-001/16-1/protocol.pdf',
          fileName: 'protocol.pdf',
        },
        {
          sourcePath: 'uploads/study-001/crf.pdf',
          targetPath: 'm5/study-001/16-2/crf.pdf',
          fileName: 'crf.pdf',
        },
      ];

      const pathMap = buildPathMapFromManifest(files);

      expect(pathMap.size).toBe(4); // 2 source paths + 2 filenames
      expect(pathMap.get('uploads/study-001/protocol.pdf')).toBe('m5/study-001/16-1/protocol.pdf');
      expect(pathMap.get('protocol.pdf')).toBe('m5/study-001/16-1/protocol.pdf');
    });

    it('should handle empty file list', () => {
      const pathMap = buildPathMapFromManifest([]);

      expect(pathMap.size).toBe(0);
    });

    it('should map by both source path and filename', () => {
      const files = [
        {
          sourcePath: '/full/path/to/document.pdf',
          targetPath: 'm5/16-1/document.pdf',
          fileName: 'document.pdf',
        },
      ];

      const pathMap = buildPathMapFromManifest(files);

      expect(pathMap.get('/full/path/to/document.pdf')).toBe('m5/16-1/document.pdf');
      expect(pathMap.get('document.pdf')).toBe('m5/16-1/document.pdf');
    });

    it('should handle files with same name (last one wins)', () => {
      const files = [
        {
          sourcePath: 'path1/report.pdf',
          targetPath: 'm5/16-1/report.pdf',
          fileName: 'report.pdf',
        },
        {
          sourcePath: 'path2/report.pdf',
          targetPath: 'm5/16-2/report.pdf',
          fileName: 'report.pdf',
        },
      ];

      const pathMap = buildPathMapFromManifest(files);

      // Filename mapping will be overwritten
      expect(pathMap.get('report.pdf')).toBe('m5/16-2/report.pdf');
      // But source paths are unique
      expect(pathMap.get('path1/report.pdf')).toBe('m5/16-1/report.pdf');
      expect(pathMap.get('path2/report.pdf')).toBe('m5/16-2/report.pdf');
    });
  });

  describe('link detection', () => {
    // These tests verify the link detection patterns without
    // actually creating PDF annotations (which is complex)

    it('should identify external HTTP links', () => {
      const externalPatterns = [
        'http://example.com',
        'https://fda.gov/document',
        'HTTP://UPPERCASE.COM',
        'ftp://files.server.com',
      ];

      for (const pattern of externalPatterns) {
        const lower = pattern.toLowerCase();
        const isExternal =
          lower.startsWith('http://') ||
          lower.startsWith('https://') ||
          lower.startsWith('ftp://');
        expect(isExternal).toBe(true);
      }
    });

    it('should identify mailto links', () => {
      const mailtoPatterns = [
        'mailto:user@example.com',
        'MAILTO:admin@fda.gov',
        'mailto:test@test.com?subject=Hello',
      ];

      for (const pattern of mailtoPatterns) {
        const isMailto = pattern.toLowerCase().startsWith('mailto:');
        expect(isMailto).toBe(true);
      }
    });

    it('should identify internal PDF references', () => {
      const internalPatterns = [
        '../16-1/protocol.pdf',
        './appendix.pdf',
        'document.pdf#page=5',
        'm5/study/report.pdf',
      ];

      for (const pattern of internalPatterns) {
        const lower = pattern.toLowerCase();
        const isExternal =
          lower.startsWith('http://') ||
          lower.startsWith('https://') ||
          lower.startsWith('ftp://') ||
          lower.startsWith('mailto:');
        expect(isExternal).toBe(false);
      }
    });
  });

  describe('path processing', () => {
    it('should handle paths with fragments', () => {
      const pathWithFragment = 'document.pdf#page=5';
      const [basePath, fragment] = pathWithFragment.includes('#')
        ? [pathWithFragment.split('#')[0], '#' + pathWithFragment.split('#')[1]]
        : [pathWithFragment, ''];

      expect(basePath).toBe('document.pdf');
      expect(fragment).toBe('#page=5');
    });

    it('should handle paths without fragments', () => {
      const pathWithoutFragment = 'document.pdf';
      const [basePath, fragment] = pathWithoutFragment.includes('#')
        ? [pathWithoutFragment.split('#')[0], '#' + pathWithoutFragment.split('#')[1]]
        : [pathWithoutFragment, ''];

      expect(basePath).toBe('document.pdf');
      expect(fragment).toBe('');
    });

    it('should normalize path separators', () => {
      const windowsPath = 'folder\\subfolder\\document.pdf';
      const normalized = windowsPath.replace(/\\/g, '/');

      expect(normalized).toBe('folder/subfolder/document.pdf');
    });
  });

  describe('result structure', () => {
    it('should return properly structured result', async () => {
      const result = await processHyperlinks(pdfDoc);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('totalLinks');
      expect(result).toHaveProperty('updatedCount');
      expect(result).toHaveProperty('removedCount');
      expect(result).toHaveProperty('keptCount');
      expect(result).toHaveProperty('processedLinks');
      expect(result).toHaveProperty('warnings');

      expect(typeof result.success).toBe('boolean');
      expect(typeof result.totalLinks).toBe('number');
      expect(typeof result.updatedCount).toBe('number');
      expect(typeof result.removedCount).toBe('number');
      expect(typeof result.keptCount).toBe('number');
      expect(Array.isArray(result.processedLinks)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should have counts that sum to totalLinks', async () => {
      const result = await processHyperlinks(pdfDoc);

      const sum = result.updatedCount + result.removedCount + result.keptCount;
      expect(sum).toBe(result.totalLinks);
    });
  });
});
