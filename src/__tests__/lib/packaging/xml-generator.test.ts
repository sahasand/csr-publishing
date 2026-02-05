/**
 * XML Generator Tests
 *
 * Tests for eCTD XML backbone generation including:
 * - Sequence number formatting
 * - index.xml generation
 * - us-regional.xml generation
 * - Leaf entry creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatSequenceNumber,
  parseSequenceNumber,
  getNextSequence,
  isValidSequence,
  determineSubmissionType,
  generateEctdXml,
} from '@/lib/packaging/xml-generator';
import {
  generateIndexXml,
  generateMinimalIndexXml,
} from '@/lib/packaging/xml-templates/index-xml';
import {
  generateUsRegionalXml,
  generateMinimalUsRegionalXml,
} from '@/lib/packaging/xml-templates/us-regional-xml';
import type {
  PackageManifest,
  SequenceInfo,
  SubmissionMetadata,
  EctdXmlConfig,
  LeafEntry,
} from '@/lib/packaging/types';

// Mock checksum calculation
vi.mock('@/lib/packaging/checksum', () => ({
  calculateMd5: vi.fn().mockResolvedValue('d41d8cd98f00b204e9800998ecf8427e'),
}));

// Mock storage
vi.mock('@/lib/storage', () => ({
  getFullPath: vi.fn((path: string) => `/mock/uploads/${path}`),
}));

describe('Sequence Number Utilities', () => {
  describe('formatSequenceNumber', () => {
    it('should format single digit', () => {
      expect(formatSequenceNumber(0)).toBe('0000');
      expect(formatSequenceNumber(1)).toBe('0001');
      expect(formatSequenceNumber(9)).toBe('0009');
    });

    it('should format double digits', () => {
      expect(formatSequenceNumber(10)).toBe('0010');
      expect(formatSequenceNumber(99)).toBe('0099');
    });

    it('should format triple digits', () => {
      expect(formatSequenceNumber(100)).toBe('0100');
      expect(formatSequenceNumber(999)).toBe('0999');
    });

    it('should format four digits', () => {
      expect(formatSequenceNumber(1000)).toBe('1000');
      expect(formatSequenceNumber(9999)).toBe('9999');
    });
  });

  describe('parseSequenceNumber', () => {
    it('should parse valid sequence strings', () => {
      expect(parseSequenceNumber('0000')).toBe(0);
      expect(parseSequenceNumber('0001')).toBe(1);
      expect(parseSequenceNumber('0123')).toBe(123);
      expect(parseSequenceNumber('9999')).toBe(9999);
    });
  });

  describe('getNextSequence', () => {
    it('should increment sequence', () => {
      expect(getNextSequence('0000')).toBe('0001');
      expect(getNextSequence('0001')).toBe('0002');
      expect(getNextSequence('0099')).toBe('0100');
      expect(getNextSequence('0999')).toBe('1000');
    });
  });

  describe('isValidSequence', () => {
    it('should validate correct sequences', () => {
      expect(isValidSequence('0000')).toBe(true);
      expect(isValidSequence('0001')).toBe(true);
      expect(isValidSequence('9999')).toBe(true);
    });

    it('should reject invalid sequences', () => {
      expect(isValidSequence('')).toBe(false);
      expect(isValidSequence('000')).toBe(false);
      expect(isValidSequence('00000')).toBe(false);
      expect(isValidSequence('abcd')).toBe(false);
      expect(isValidSequence('12')).toBe(false);
    });
  });

  describe('determineSubmissionType', () => {
    it('should return original for 0000', () => {
      expect(determineSubmissionType('0000')).toBe('original');
    });

    it('should return amendment for non-zero', () => {
      expect(determineSubmissionType('0001')).toBe('amendment');
      expect(determineSubmissionType('0010')).toBe('amendment');
      expect(determineSubmissionType('9999')).toBe('amendment');
    });
  });
});

describe('Index XML Generation', () => {
  const defaultConfig: EctdXmlConfig = {
    ectdVersion: '4.0',
    dtdVersion: '3.3',
    region: 'us',
    includeDtd: true,
    encoding: 'UTF-8',
    prettyPrint: true,
  };

  const defaultMetadata: SubmissionMetadata = {
    sponsor: 'Test Pharma Inc',
    studyNumber: 'STUDY-001',
    submissionDate: new Date('2024-01-15'),
  };

  const defaultSequence: SequenceInfo = {
    number: '0000',
    type: 'original',
  };

  describe('generateIndexXml', () => {
    it('should generate valid XML declaration', () => {
      const xml = generateIndexXml(defaultMetadata, defaultSequence, [], defaultConfig);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    });

    it('should include DTD reference when configured', () => {
      const xml = generateIndexXml(defaultMetadata, defaultSequence, [], defaultConfig);

      expect(xml).toContain('<!DOCTYPE ectd:ectd SYSTEM "ich-ectd-3.3.dtd">');
    });

    it('should include eCTD namespaces', () => {
      const xml = generateIndexXml(defaultMetadata, defaultSequence, [], defaultConfig);

      expect(xml).toContain('xmlns:ectd="http://www.ich.org/ectd"');
      expect(xml).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    });

    it('should include submission info', () => {
      const xml = generateIndexXml(defaultMetadata, defaultSequence, [], defaultConfig);

      expect(xml).toContain('<sequence>0000</sequence>');
      expect(xml).toContain('<submission-type>original</submission-type>');
    });

    it('should include applicant info', () => {
      const xml = generateIndexXml(defaultMetadata, defaultSequence, [], defaultConfig);

      expect(xml).toContain('<name>Test Pharma Inc</name>');
    });

    it('should include study info', () => {
      const xml = generateIndexXml(defaultMetadata, defaultSequence, [], defaultConfig);

      expect(xml).toContain('<study-number>STUDY-001</study-number>');
    });

    it('should include leaf entries when provided', () => {
      const leaves: LeafEntry[] = [
        {
          id: 'leaf-16-1-1',
          href: 'm5/study-001/16-1/protocol.pdf',
          checksum: 'd41d8cd98f00b204e9800998ecf8427e',
          checksumType: 'md5',
          fileSize: 1024,
          title: '16.1 - Protocol',
          nodeCode: '16.1',
        },
      ];

      const xml = generateIndexXml(defaultMetadata, defaultSequence, leaves, defaultConfig);

      expect(xml).toContain('ID="leaf-16-1-1"');
      expect(xml).toContain('xlink:href="m5/study-001/16-1/protocol.pdf"');
      expect(xml).toContain('checksum="d41d8cd98f00b204e9800998ecf8427e"');
      expect(xml).toContain('checksum-type="md5"');
    });

    it('should escape XML special characters', () => {
      const metadataWithSpecialChars: SubmissionMetadata = {
        ...defaultMetadata,
        sponsor: 'Test & Co <Inc>',
      };

      const xml = generateIndexXml(metadataWithSpecialChars, defaultSequence, [], defaultConfig);

      expect(xml).toContain('Test &amp; Co &lt;Inc&gt;');
      expect(xml).not.toContain('Test & Co <Inc>');
    });
  });

  describe('generateMinimalIndexXml', () => {
    it('should generate valid minimal XML', () => {
      const xml = generateMinimalIndexXml('STUDY-123');

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<study-number>STUDY-123</study-number>');
      expect(xml).toContain('<sequence>0000</sequence>');
    });
  });
});

describe('US Regional XML Generation', () => {
  const defaultConfig: EctdXmlConfig = {
    ectdVersion: '4.0',
    dtdVersion: '3.3',
    region: 'us',
    includeDtd: true,
    encoding: 'UTF-8',
    prettyPrint: true,
  };

  const defaultSequence: SequenceInfo = {
    number: '0000',
    type: 'original',
  };

  describe('generateUsRegionalXml', () => {
    it('should generate valid FDA regional XML', () => {
      const metadata = {
        sponsor: 'Test Pharma',
        studyNumber: 'STUDY-001',
        submissionDate: new Date('2024-01-15'),
      };

      const xml = generateUsRegionalXml(metadata, defaultSequence, [], defaultConfig);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('xmlns:fda="http://www.fda.gov/cder/ectd"');
      expect(xml).toContain('<applicant-name>Test Pharma</applicant-name>');
    });

    it('should include FDA-specific fields when provided', () => {
      const metadata = {
        sponsor: 'Test Pharma',
        studyNumber: 'STUDY-001',
        submissionDate: new Date('2024-01-15'),
        fdaApplicationType: 'nda' as const,
        applicationNumber: 'NDA-123456',
        dunsNumber: '123456789',
      };

      const xml = generateUsRegionalXml(metadata, defaultSequence, [], defaultConfig);

      expect(xml).toContain('<application-type>nda</application-type>');
      expect(xml).toContain('<application-number>NDA-123456</application-number>');
      expect(xml).toContain('<duns-number>123456789</duns-number>');
    });
  });

  describe('generateMinimalUsRegionalXml', () => {
    it('should generate minimal FDA XML', () => {
      const xml = generateMinimalUsRegionalXml('Test Sponsor', new Date('2024-01-15'));

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<fda:fda');
      expect(xml).toContain('<applicant-name>Test Sponsor</applicant-name>');
    });
  });
});

describe('generateEctdXml Integration', () => {
  const createMockManifest = (): PackageManifest => ({
    studyId: 'study-uuid-123',
    studyNumber: 'STUDY-001',
    generatedAt: new Date(),
    files: [
      {
        sourceDocumentId: 'doc-1',
        sourcePath: 'studies/study-001/protocol.pdf',
        targetPath: 'm5/study-001/16-1/protocol.pdf',
        nodeCode: '16.1',
        nodeTitle: 'Protocol',
        fileName: 'protocol.pdf',
        version: 1,
        fileSize: 1024,
      },
      {
        sourceDocumentId: 'doc-2',
        sourcePath: 'studies/study-001/amendments.pdf',
        targetPath: 'm5/study-001/16-1-1/amendments.pdf',
        nodeCode: '16.1.1',
        nodeTitle: 'Amendments',
        fileName: 'amendments.pdf',
        version: 1,
        fileSize: 2048,
      },
    ],
    readiness: {
      ready: true,
      missingRequired: [],
      pendingApproval: [],
      validationErrors: 0,
      unresolvedAnnotations: 0,
      totalFiles: 2,
      totalRequiredNodes: 2,
    },
    folderStructure: [],
  });

  it('should generate both index.xml and us-regional.xml', async () => {
    const manifest = createMockManifest();

    const result = await generateEctdXml(manifest, {
      skipChecksums: true,
      metadata: {
        sponsor: 'Test Pharma',
      },
    });

    expect(result.indexXml).toBeTruthy();
    expect(result.regionalXml).toBeTruthy();
    expect(result.leafEntries).toHaveLength(2);
  });

  it('should create leaf entries for each file', async () => {
    const manifest = createMockManifest();

    const result = await generateEctdXml(manifest, {
      skipChecksums: true,
    });

    expect(result.leafEntries).toHaveLength(2);

    const leaf1 = result.leafEntries.find((l) => l.nodeCode === '16.1');
    expect(leaf1).toBeDefined();
    expect(leaf1!.href).toBe('m5/study-001/16-1/protocol.pdf');

    const leaf2 = result.leafEntries.find((l) => l.nodeCode === '16.1.1');
    expect(leaf2).toBeDefined();
    expect(leaf2!.href).toBe('m5/study-001/16-1-1/amendments.pdf');
  });

  it('should use provided sequence number', async () => {
    const manifest = createMockManifest();

    const result = await generateEctdXml(manifest, {
      skipChecksums: true,
      sequence: {
        number: '0001',
        type: 'amendment',
      },
    });

    expect(result.indexXml).toContain('<sequence>0001</sequence>');
    expect(result.indexXml).toContain('<submission-type>amendment</submission-type>');
  });

  it('should sort leaf entries by node code', async () => {
    const manifest = createMockManifest();
    // Add files in reverse order
    manifest.files = [
      {
        sourceDocumentId: 'doc-3',
        sourcePath: 'studies/study-001/file3.pdf',
        targetPath: 'm5/study-001/16-2/file3.pdf',
        nodeCode: '16.2',
        nodeTitle: 'Section 16.2',
        fileName: 'file3.pdf',
        version: 1,
        fileSize: 1024,
      },
      {
        sourceDocumentId: 'doc-1',
        sourcePath: 'studies/study-001/file1.pdf',
        targetPath: 'm5/study-001/16-1/file1.pdf',
        nodeCode: '16.1',
        nodeTitle: 'Section 16.1',
        fileName: 'file1.pdf',
        version: 1,
        fileSize: 1024,
      },
      {
        sourceDocumentId: 'doc-2',
        sourcePath: 'studies/study-001/file2.pdf',
        targetPath: 'm5/study-001/16-1-1/file2.pdf',
        nodeCode: '16.1.1',
        nodeTitle: 'Section 16.1.1',
        fileName: 'file2.pdf',
        version: 1,
        fileSize: 1024,
      },
    ];

    const result = await generateEctdXml(manifest, {
      skipChecksums: true,
    });

    const codes = result.leafEntries.map((l) => l.nodeCode);
    expect(codes).toEqual(['16.1', '16.1.1', '16.2']);
  });
});
