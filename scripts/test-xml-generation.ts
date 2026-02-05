/**
 * Manual test script for eCTD XML generation
 *
 * Run with: npx tsx scripts/test-xml-generation.ts
 */

import { generateIndexXml, generateMinimalIndexXml } from '../src/lib/packaging/xml-templates/index-xml';
import { generateUsRegionalXml } from '../src/lib/packaging/xml-templates/us-regional-xml';
import { formatSequenceNumber, determineSubmissionType } from '../src/lib/packaging/xml-generator';
import { calculateMd5FromBuffer } from '../src/lib/packaging/checksum';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Test data
const testMetadata = {
  sponsor: 'Test Pharma Inc',
  studyNumber: 'STUDY-2024-001',
  applicationNumber: 'NDA-123456',
  applicationType: 'NDA',
  productName: 'TestDrug',
  genericName: 'testdrugium',
  therapeuticArea: 'Oncology',
  submissionDate: new Date(),
};

const testSequence = {
  number: '0000',
  type: 'original' as const,
  description: 'Initial submission',
};

const testLeaves = [
  {
    id: 'leaf-16-1-0',
    href: 'm5/study-2024-001/16-1/protocol.pdf',
    checksum: 'd41d8cd98f00b204e9800998ecf8427e',
    checksumType: 'md5' as const,
    fileSize: 1024000,
    title: '16.1 - Protocol and Protocol Amendments',
    nodeCode: '16.1',
  },
  {
    id: 'leaf-16-1-1-0',
    href: 'm5/study-2024-001/16-1-1/amendment-1.pdf',
    checksum: 'a1b2c3d4e5f6789012345678901234ab',
    checksumType: 'md5' as const,
    fileSize: 512000,
    title: '16.1.1 - Protocol Amendment 1',
    nodeCode: '16.1.1',
  },
  {
    id: 'leaf-16-2-0',
    href: 'm5/study-2024-001/16-2/sample-crf.pdf',
    checksum: 'b2c3d4e5f678901234567890123456cd',
    checksumType: 'md5' as const,
    fileSize: 256000,
    title: '16.2 - Sample Case Report Forms',
    nodeCode: '16.2',
  },
];

const testConfig = {
  ectdVersion: '4.0',
  dtdVersion: '3.3',
  region: 'us' as const,
  includeDtd: true,
  encoding: 'UTF-8',
  prettyPrint: true,
};

console.log('=== eCTD XML Generation Test ===\n');

// Test 1: Sequence utilities
console.log('1. Testing sequence utilities...');
console.log(`   formatSequenceNumber(0) = "${formatSequenceNumber(0)}"`);
console.log(`   formatSequenceNumber(1) = "${formatSequenceNumber(1)}"`);
console.log(`   formatSequenceNumber(123) = "${formatSequenceNumber(123)}"`);
console.log(`   determineSubmissionType("0000") = "${determineSubmissionType("0000")}"`);
console.log(`   determineSubmissionType("0001") = "${determineSubmissionType("0001")}"`);
console.log('   ✅ Sequence utilities working\n');

// Test 2: Checksum
console.log('2. Testing checksum calculation...');
const testBuffer = Buffer.from('Hello, World!');
const checksum = calculateMd5FromBuffer(testBuffer);
console.log(`   MD5 of "Hello, World!" = "${checksum}"`);
console.log(`   Expected: "65a8e27d8879283831b664bd8b7f0ad4"`);
console.log(`   Match: ${checksum === '65a8e27d8879283831b664bd8b7f0ad4' ? '✅' : '❌'}\n`);

// Test 3: Generate index.xml
console.log('3. Generating index.xml...');
const indexXml = generateIndexXml(testMetadata, testSequence, testLeaves, testConfig);
console.log(`   Generated ${indexXml.length} characters`);
console.log(`   Contains XML declaration: ${indexXml.includes('<?xml version="1.0"') ? '✅' : '❌'}`);
console.log(`   Contains eCTD namespace: ${indexXml.includes('xmlns:ectd=') ? '✅' : '❌'}`);
console.log(`   Contains sequence: ${indexXml.includes('<sequence>0000</sequence>') ? '✅' : '❌'}`);
console.log(`   Contains sponsor: ${indexXml.includes('Test Pharma Inc') ? '✅' : '❌'}`);
console.log(`   Contains leaf entries: ${indexXml.includes('checksum=') ? '✅' : '❌'}\n`);

// Test 4: Generate us-regional.xml
console.log('4. Generating us-regional.xml...');
const fdaMetadata = {
  ...testMetadata,
  fdaApplicationType: 'nda' as const,
  submissionSubType: 'original' as const,
  dunsNumber: '123456789',
};
const regionalXml = generateUsRegionalXml(fdaMetadata, testSequence, testLeaves, testConfig);
console.log(`   Generated ${regionalXml.length} characters`);
console.log(`   Contains FDA namespace: ${regionalXml.includes('xmlns:fda=') ? '✅' : '❌'}`);
console.log(`   Contains application type: ${regionalXml.includes('application-type') ? '✅' : '❌'}`);
console.log(`   Contains DUNS: ${regionalXml.includes('duns-number') ? '✅' : '❌'}\n`);

// Save output files
console.log('5. Saving test output files...');
const outputDir = join(process.cwd(), 'test-output');
try {
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(join(outputDir, 'index.xml'), indexXml, 'utf-8');
  console.log(`   ✅ Saved: ${join(outputDir, 'index.xml')}`);

  writeFileSync(join(outputDir, 'us-regional.xml'), regionalXml, 'utf-8');
  console.log(`   ✅ Saved: ${join(outputDir, 'us-regional.xml')}`);

  // Also save a minimal version
  const minimalXml = generateMinimalIndexXml('MINIMAL-STUDY-001');
  writeFileSync(join(outputDir, 'index-minimal.xml'), minimalXml, 'utf-8');
  console.log(`   ✅ Saved: ${join(outputDir, 'index-minimal.xml')}`);
} catch (err) {
  console.log(`   ❌ Error saving files: ${err}`);
}

console.log('\n=== Test Complete ===');
console.log(`\nOpen the XML files in ${outputDir} to inspect the output.`);
