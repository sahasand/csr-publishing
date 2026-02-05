/**
 * Tests for eCTD-Specific Validation Checks
 *
 * These tests verify the validation check logic.
 * For end-to-end testing with real PDFs, use scripts/test-ectd-validation.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  checkFileNaming,
  checkExternalHyperlinks,
  checkNoJavaScript,
} from '@/lib/validation/checks/ectd-checks';

// Test output directory
const TEST_DIR = './test-output/validation';

describe('ectd-checks', () => {
  const createdFiles: string[] = [];

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    for (const filePath of createdFiles) {
      try {
        await unlink(filePath);
      } catch {
        // Ignore
      }
    }
    createdFiles.length = 0;
  });

  /**
   * Helper to create a minimal test PDF
   */
  async function createMinimalPdf(fileName: string): Promise<string> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBytes = await pdfDoc.save();
    const filePath = join(TEST_DIR, fileName);
    await writeFile(filePath, pdfBytes);
    createdFiles.push(filePath);
    return filePath;
  }

  describe('checkFileNaming', () => {
    it('should pass for valid lowercase filename', async () => {
      const filePath = await createMinimalPdf('protocol-v1.pdf');
      const result = await checkFileNaming(filePath, { maxLength: 64, requireLowercase: true });

      expect(result.passed).toBe(true);
      expect(result.details?.fileName).toBe('protocol-v1.pdf');
    });

    it('should fail for filename with spaces', async () => {
      const filePath = await createMinimalPdf('my document.pdf');
      const result = await checkFileNaming(filePath, {});

      expect(result.passed).toBe(false);
      expect(result.message).toContain('spaces');
    });

    it('should fail for filename exceeding max length', async () => {
      const longName = 'a'.repeat(70) + '.pdf';
      const filePath = await createMinimalPdf(longName);
      const result = await checkFileNaming(filePath, { maxLength: 64 });

      expect(result.passed).toBe(false);
      expect(result.message).toContain('exceeds maximum length');
    });

    it('should fail for uppercase when lowercase required', async () => {
      const filePath = await createMinimalPdf('Document.pdf');
      const result = await checkFileNaming(filePath, { requireLowercase: true });

      expect(result.passed).toBe(false);
      expect(result.message).toContain('uppercase');
    });

    it('should pass for uppercase when lowercase not required', async () => {
      const filePath = await createMinimalPdf('Document.pdf');
      const result = await checkFileNaming(filePath, { requireLowercase: false });

      expect(result.passed).toBe(true);
    });

    it('should fail for file starting with special char', async () => {
      const filePath = await createMinimalPdf('_underscore-start.pdf');
      const result = await checkFileNaming(filePath, {});

      expect(result.passed).toBe(false);
      expect(result.message).toContain('alphanumeric');
    });

    it('should fail for consecutive special characters', async () => {
      const filePath = await createMinimalPdf('doc--name.pdf');
      const result = await checkFileNaming(filePath, {});

      expect(result.passed).toBe(false);
      expect(result.message).toContain('consecutive');
    });
  });

  describe('checkExternalHyperlinks', () => {
    it('should pass for PDF without external links', async () => {
      const filePath = await createMinimalPdf('no-links.pdf');
      const result = await checkExternalHyperlinks(filePath, {});

      expect(result.passed).toBe(true);
      expect(result.details?.totalExternalLinks).toBe(0);
    });

    it('should use allowExternal=false as default', async () => {
      const filePath = await createMinimalPdf('test.pdf');
      const result = await checkExternalHyperlinks(filePath, {});

      expect(result.details?.allowExternal).toBe(false);
    });

    it('should handle missing file gracefully', async () => {
      const result = await checkExternalHyperlinks('/nonexistent/file.pdf', {});

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Unable to check');
    });
  });

  describe('checkNoJavaScript', () => {
    it('should pass for PDF without JavaScript', async () => {
      const filePath = await createMinimalPdf('no-js.pdf');
      const result = await checkNoJavaScript(filePath, {});

      expect(result.passed).toBe(true);
      expect(result.details?.hasJavaScript).toBe(false);
    });

    it('should handle missing file gracefully', async () => {
      const result = await checkNoJavaScript('/nonexistent/file.pdf', {});

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Unable to check');
    });
  });

  describe('check function error handling', () => {
    it('checkFileNaming handles invalid path', async () => {
      const result = await checkFileNaming('/nonexistent/path/file.pdf', {});
      // Should still check the filename even if file doesn't exist
      expect(result.passed).toBe(true); // filename itself is valid
    });
  });
});
