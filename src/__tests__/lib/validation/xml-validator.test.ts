/**
 * Tests for eCTD XML Validator
 */

import { describe, it, expect } from 'vitest';
import {
  validateIndexXml,
  validateUsRegionalXml,
  validateEctdXml,
  formatXmlValidationReport,
} from '@/lib/validation/xml-validator';

/**
 * Generate a minimal valid index.xml for testing
 */
function createValidIndexXml(options: {
  sequence?: string;
  submissionType?: string;
  studyNumber?: string;
  sponsor?: string;
  leaves?: { id: string; href: string; checksum: string }[];
} = {}): string {
  const {
    sequence = '0000',
    submissionType = 'original',
    studyNumber = 'STUDY-001',
    sponsor = 'Test Sponsor',
    leaves = [],
  } = options;

  const leafElements = leaves.map(
    (l) => `    <leaf ID="${l.id}" xlink:href="${l.href}" checksum="${l.checksum}" checksum-type="md5">
      <title>Test Document</title>
    </leaf>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ectd:ectd SYSTEM "ich-ectd-3.3.dtd">
<ectd:ectd xmlns:ectd="http://www.ich.org/ectd" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <submission>
    <sequence>${sequence}</sequence>
    <submission-type>${submissionType}</submission-type>
    <submission-date>2024-01-15</submission-date>
  </submission>
  <applicant>
    <name>${sponsor}</name>
  </applicant>
  <study>
    <study-number>${studyNumber}</study-number>
  </study>
  <m5 ID="m5">
    <title>Clinical Study Reports</title>
${leafElements}
  </m5>
</ectd:ectd>`;
}

/**
 * Generate a minimal valid us-regional.xml for testing
 */
function createValidUsRegionalXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<fda:fda xmlns:fda="http://www.fda.gov/cder/ectd" xmlns:xlink="http://www.w3.org/1999/xlink">
  <submission-type>NDA</submission-type>
  <application-number>123456</application-number>
</fda:fda>`;
}

describe('xml-validator', () => {
  describe('validateIndexXml', () => {
    it('should validate a correct index.xml', () => {
      const xml = createValidIndexXml();
      const result = validateIndexXml(xml);

      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
      expect(result.xmlType).toBe('index');
    });

    it('should extract metadata from valid XML', () => {
      const xml = createValidIndexXml({
        sequence: '0001',
        submissionType: 'amendment',
        studyNumber: 'PROTO-123',
        sponsor: 'Acme Pharma',
      });
      const result = validateIndexXml(xml);

      expect(result.metadata?.sequence).toBe('0001');
      expect(result.metadata?.submissionType).toBe('amendment');
      expect(result.metadata?.studyNumber).toBe('PROTO-123');
      expect(result.metadata?.sponsor).toBe('Acme Pharma');
    });

    it('should detect missing XML declaration', () => {
      const xml = '<ectd:ectd></ectd:ectd>';
      const result = validateIndexXml(xml);

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.rule === 'xml-declaration')).toBe(true);
    });

    it('should detect missing root element', () => {
      const xml = '<?xml version="1.0"?><invalid></invalid>';
      const result = validateIndexXml(xml);

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.rule === 'root-element')).toBe(true);
    });

    it('should detect missing required elements', () => {
      const xml = `<?xml version="1.0"?>
<ectd:ectd xmlns:ectd="http://www.ich.org/ectd" xmlns:xlink="http://www.w3.org/1999/xlink">
</ectd:ectd>`;
      const result = validateIndexXml(xml);

      expect(result.valid).toBe(false);
      expect(result.issues.filter((i) => i.rule === 'required-element').length).toBeGreaterThan(0);
    });

    it('should detect invalid sequence format', () => {
      const xml = createValidIndexXml({ sequence: '1' }); // Should be 4 digits
      const result = validateIndexXml(xml);

      expect(result.issues.some((i) => i.rule === 'sequence-format')).toBe(true);
    });

    it('should detect missing namespaces', () => {
      const xml = `<?xml version="1.0"?>
<ectd:ectd>
  <submission><sequence>0000</sequence><submission-type>original</submission-type><submission-date>2024-01-01</submission-date></submission>
  <applicant><name>Test</name></applicant>
  <study><study-number>TEST-001</study-number></study>
</ectd:ectd>`;
      const result = validateIndexXml(xml);

      expect(result.issues.some((i) => i.rule === 'namespace')).toBe(true);
    });

    describe('leaf element validation', () => {
      it('should validate correct leaf elements', () => {
        const xml = createValidIndexXml({
          leaves: [
            { id: 'leaf-1', href: 'm5/53-csr/protocol.pdf', checksum: 'd41d8cd98f00b204e9800998ecf8427e' },
          ],
        });
        const result = validateIndexXml(xml);

        expect(result.valid).toBe(true);
        expect(result.metadata?.leafCount).toBe(1);
      });

      it('should detect duplicate leaf IDs', () => {
        const xml = createValidIndexXml({
          leaves: [
            { id: 'leaf-1', href: 'm5/53-csr/doc1.pdf', checksum: 'd41d8cd98f00b204e9800998ecf8427e' },
            { id: 'leaf-1', href: 'm5/53-csr/doc2.pdf', checksum: 'd41d8cd98f00b204e9800998ecf8427e' },
          ],
        });
        const result = validateIndexXml(xml);

        expect(result.issues.some((i) => i.rule === 'duplicate-id')).toBe(true);
      });

      it('should detect invalid checksum format', () => {
        const xml = createValidIndexXml({
          leaves: [
            { id: 'leaf-1', href: 'm5/53-csr/protocol.pdf', checksum: 'invalid' },
          ],
        });
        const result = validateIndexXml(xml);

        expect(result.issues.some((i) => i.rule === 'checksum-format')).toBe(true);
      });

      it('should skip checksum validation when option set', () => {
        const xml = createValidIndexXml({
          leaves: [
            { id: 'leaf-1', href: 'm5/53-csr/protocol.pdf', checksum: 'invalid' },
          ],
        });
        const result = validateIndexXml(xml, { skipChecksumValidation: true });

        expect(result.issues.some((i) => i.rule === 'checksum-format')).toBe(false);
      });

      it('should detect backslashes in href', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ectd:ectd xmlns:ectd="http://www.ich.org/ectd" xmlns:xlink="http://www.w3.org/1999/xlink">
  <submission>
    <sequence>0000</sequence>
    <submission-type>original</submission-type>
    <submission-date>2024-01-15</submission-date>
  </submission>
  <applicant><name>Test</name></applicant>
  <study><study-number>TEST-001</study-number></study>
  <m5 ID="m5">
    <title>CSR</title>
    <leaf ID="leaf-1" xlink:href="m5\\53-csr\\protocol.pdf" checksum="d41d8cd98f00b204e9800998ecf8427e" checksum-type="md5">
      <title>Protocol</title>
    </leaf>
  </m5>
</ectd:ectd>`;
        const result = validateIndexXml(xml);

        expect(result.issues.some((i) => i.rule === 'href-format')).toBe(true);
      });

      it('should cross-reference leaf hrefs with package files', () => {
        const xml = createValidIndexXml({
          leaves: [
            { id: 'leaf-1', href: 'm5/53-csr/nonexistent.pdf', checksum: 'd41d8cd98f00b204e9800998ecf8427e' },
          ],
        });

        const result = validateIndexXml(xml, {
          packageFiles: [
            {
              sourceDocumentId: 'doc-1',
              sourcePath: 'uploads/protocol.pdf',
              targetPath: 'm5/53-csr/protocol.pdf',
              nodeCode: '5.3',
              nodeTitle: 'Protocol',
              fileName: 'protocol.pdf',
              version: 1,
              fileSize: 1024,
            },
          ],
        });

        expect(result.issues.some((i) => i.rule === 'href-reference')).toBe(true);
      });
    });

    describe('module validation', () => {
      it('should detect unclosed modules', () => {
        const xml = `<?xml version="1.0"?>
<ectd:ectd xmlns:ectd="http://www.ich.org/ectd" xmlns:xlink="http://www.w3.org/1999/xlink">
  <submission><sequence>0000</sequence><submission-type>original</submission-type><submission-date>2024-01-01</submission-date></submission>
  <applicant><name>Test</name></applicant>
  <study><study-number>TEST-001</study-number></study>
  <m5 ID="m5">
    <title>CSR</title>
</ectd:ectd>`;
        const result = validateIndexXml(xml);

        expect(result.issues.some((i) => i.rule === 'unclosed-module')).toBe(true);
      });
    });
  });

  describe('validateUsRegionalXml', () => {
    it('should validate a correct us-regional.xml', () => {
      const xml = createValidUsRegionalXml();
      const result = validateUsRegionalXml(xml);

      expect(result.valid).toBe(true);
      expect(result.xmlType).toBe('us-regional');
    });

    it('should detect missing XML declaration', () => {
      const xml = '<fda:fda></fda:fda>';
      const result = validateUsRegionalXml(xml);

      expect(result.issues.some((i) => i.rule === 'xml-declaration')).toBe(true);
    });

    it('should detect missing root element', () => {
      const xml = '<?xml version="1.0"?><invalid></invalid>';
      const result = validateUsRegionalXml(xml);

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.rule === 'root-element')).toBe(true);
    });
  });

  describe('validateEctdXml', () => {
    it('should validate both index and regional XML', () => {
      const indexXml = createValidIndexXml();
      const regionalXml = createValidUsRegionalXml();

      const result = validateEctdXml(indexXml, regionalXml);

      expect(result.combinedValid).toBe(true);
      expect(result.indexResult.valid).toBe(true);
      expect(result.regionalResult.valid).toBe(true);
      expect(result.totalErrors).toBe(0);
    });

    it('should report combined errors', () => {
      const indexXml = '<invalid></invalid>';
      const regionalXml = '<invalid></invalid>';

      const result = validateEctdXml(indexXml, regionalXml);

      expect(result.combinedValid).toBe(false);
      expect(result.totalErrors).toBeGreaterThan(0);
    });
  });

  describe('formatXmlValidationReport', () => {
    it('should format a valid report', () => {
      const xml = createValidIndexXml({ sequence: '0001', studyNumber: 'STUDY-123' });
      const result = validateIndexXml(xml);
      const report = formatXmlValidationReport(result);

      expect(report).toContain('XML Validation Report');
      expect(report).toContain('VALID');
      expect(report).toContain('Sequence: 0001');
      expect(report).toContain('Study: STUDY-123');
    });

    it('should format an invalid report with errors', () => {
      const xml = '<invalid></invalid>';
      const result = validateIndexXml(xml);
      const report = formatXmlValidationReport(result);

      expect(report).toContain('INVALID');
      expect(report).toContain('ERRORS:');
    });
  });
});
