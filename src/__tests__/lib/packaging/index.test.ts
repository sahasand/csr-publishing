import { describe, it, expect } from 'vitest';
import * as packaging from '@/lib/packaging';

describe('packaging module exports', () => {
  it('exports folder structure utilities', () => {
    expect(packaging.codeToFolderPath).toBeDefined();
    expect(packaging.sanitizePathComponent).toBeDefined();
    expect(packaging.sanitizeFileName).toBeDefined();
    expect(packaging.buildFolderTree).toBeDefined();
  });

  it('exports hyperlink utilities', () => {
    expect(packaging.classifyLink).toBeDefined();
    expect(packaging.validateCrossDocumentLink).toBeDefined();
    expect(packaging.generateHyperlinkReport).toBeDefined();
    expect(packaging.exportReportAsCsv).toBeDefined();
  });

  it('exports bookmark utilities', () => {
    expect(packaging.truncateTitle).toBeDefined();
    expect(packaging.enforceMaxDepth).toBeDefined();
    expect(packaging.buildSectionBookmarks).toBeDefined();
    expect(packaging.calculateMaxDepth).toBeDefined();
    expect(packaging.countBookmarks).toBeDefined();
  });

  it('exports assembly functions', () => {
    expect(packaging.checkReadiness).toBeDefined();
    expect(packaging.assemblePackage).toBeDefined();
  });

  it('exports ZIP generation functions', () => {
    expect(packaging.createZipArchive).toBeDefined();
    expect(packaging.createEctdStructure).toBeDefined();
  });

  it('exports default configs', () => {
    expect(packaging.DEFAULT_ASSEMBLY_OPTIONS).toBeDefined();
    expect(packaging.DEFAULT_BOOKMARK_CONFIG).toBeDefined();
  });
});
