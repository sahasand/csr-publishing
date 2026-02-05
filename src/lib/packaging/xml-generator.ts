/**
 * eCTD XML Generator
 *
 * Main orchestration module for generating eCTD XML backbone files.
 * Coordinates checksum calculation, leaf entry generation, and XML output.
 */

import { calculateMd5 } from './checksum';
import { generateIndexXml } from './xml-templates/index-xml';
import { generateUsRegionalXml, type FdaMetadata } from './xml-templates/us-regional-xml';
import type {
  PackageManifest,
  PackageFile,
  LeafEntry,
  SequenceInfo,
  SubmissionMetadata,
  EctdXmlConfig,
  XmlGenerationResult,
  SubmissionType,
} from './types';

// Re-export for convenience
export { DEFAULT_ECTD_CONFIG } from './types';
export type { FdaMetadata } from './xml-templates/us-regional-xml';

/**
 * Options for XML generation
 */
export interface XmlGenerationOptions {
  /** eCTD XML configuration */
  config?: Partial<EctdXmlConfig>;
  /** Sequence information */
  sequence?: Partial<SequenceInfo>;
  /** Additional metadata */
  metadata?: Partial<SubmissionMetadata>;
  /** FDA-specific metadata (for US regional) */
  fdaMetadata?: Partial<FdaMetadata>;
  /** Skip checksum calculation (use empty strings) - for testing only */
  skipChecksums?: boolean;
  /** Leaf ID prefix */
  leafIdPrefix?: string;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<XmlGenerationOptions> = {
  config: {},
  sequence: {},
  metadata: {},
  fdaMetadata: {},
  skipChecksums: false,
  leafIdPrefix: 'leaf',
};

/**
 * Generate a unique leaf ID from file path
 */
function generateLeafId(
  file: PackageFile,
  index: number,
  prefix: string
): string {
  // Create ID from node code: "16.2.1" -> "leaf-16-2-1"
  const codeId = file.nodeCode.replace(/\./g, '-');
  return `${prefix}-${codeId}-${index}`;
}

/**
 * Convert a package file to a leaf entry
 */
async function fileToLeafEntry(
  file: PackageFile,
  index: number,
  options: Required<XmlGenerationOptions>
): Promise<{ leaf: LeafEntry; warning?: string }> {
  let checksum = '';
  let warning: string | undefined;

  // Calculate checksum if not skipping
  if (!options.skipChecksums) {
    try {
      checksum = await calculateMd5(file.sourcePath);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      warning = `Failed to calculate checksum for ${file.fileName}: ${errorMsg}`;
      checksum = '00000000000000000000000000000000'; // Placeholder
    }
  }

  // Ensure forward slashes in href
  const href = file.targetPath.replace(/\\/g, '/');

  const leaf: LeafEntry = {
    id: generateLeafId(file, index, options.leafIdPrefix),
    href,
    checksum,
    checksumType: 'md5',
    fileSize: file.fileSize,
    title: `${file.nodeCode} - ${file.nodeTitle}`,
    nodeCode: file.nodeCode,
  };

  return { leaf, warning };
}

/**
 * Build leaf entries from package manifest
 */
async function buildLeafEntries(
  manifest: PackageManifest,
  options: Required<XmlGenerationOptions>
): Promise<{ leaves: LeafEntry[]; warnings: string[] }> {
  const leaves: LeafEntry[] = [];
  const warnings: string[] = [];

  // Process files in parallel batches for efficiency
  const batchSize = 10;
  const files = manifest.files;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((file, batchIndex) =>
        fileToLeafEntry(file, i + batchIndex, options)
      )
    );

    for (const { leaf, warning } of results) {
      leaves.push(leaf);
      if (warning) {
        warnings.push(warning);
      }
    }
  }

  // Sort leaves by node code for consistent ordering
  leaves.sort((a, b) => {
    const aParts = a.nodeCode.split('.').map(Number);
    const bParts = b.nodeCode.split('.').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] ?? 0;
      const bVal = bParts[i] ?? 0;
      if (aVal !== bVal) {
        return aVal - bVal;
      }
    }
    return 0;
  });

  return { leaves, warnings };
}

/**
 * Build submission metadata from study and options
 */
function buildMetadata(
  manifest: PackageManifest,
  options: Required<XmlGenerationOptions>
): SubmissionMetadata {
  return {
    sponsor: options.metadata.sponsor || 'Unknown Sponsor',
    studyNumber: manifest.studyNumber,
    applicationNumber: options.metadata.applicationNumber,
    applicationType: options.metadata.applicationType,
    therapeuticArea: options.metadata.therapeuticArea,
    productName: options.metadata.productName,
    genericName: options.metadata.genericName,
    manufacturer: options.metadata.manufacturer,
    submissionDate: options.metadata.submissionDate || new Date(),
  };
}

/**
 * Build sequence information
 */
function buildSequence(
  options: Required<XmlGenerationOptions>
): SequenceInfo {
  return {
    number: options.sequence.number || '0000',
    type: options.sequence.type || 'original',
    description: options.sequence.description,
    relatedSequence: options.sequence.relatedSequence,
  };
}

/**
 * Build full eCTD XML configuration
 */
function buildConfig(
  options: Required<XmlGenerationOptions>
): EctdXmlConfig {
  const defaultConfig: EctdXmlConfig = {
    ectdVersion: '4.0',
    dtdVersion: '3.3',
    region: 'us',
    includeDtd: true,
    encoding: 'UTF-8',
    prettyPrint: true,
  };

  return {
    ...defaultConfig,
    ...options.config,
  };
}

/**
 * Generate complete eCTD XML files for a package
 *
 * This is the main entry point for XML generation. It:
 * 1. Calculates MD5 checksums for all files
 * 2. Builds leaf entries
 * 3. Generates index.xml
 * 4. Generates regional XML (us-regional.xml for FDA)
 *
 * @param manifest - Package manifest with file list
 * @param options - Generation options
 * @returns XML content and leaf entries
 */
export async function generateEctdXml(
  manifest: PackageManifest,
  options: XmlGenerationOptions = {}
): Promise<XmlGenerationResult> {
  // Merge with defaults
  const fullOptions: Required<XmlGenerationOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
    config: { ...DEFAULT_OPTIONS.config, ...options.config },
    sequence: { ...DEFAULT_OPTIONS.sequence, ...options.sequence },
    metadata: { ...DEFAULT_OPTIONS.metadata, ...options.metadata },
    fdaMetadata: { ...DEFAULT_OPTIONS.fdaMetadata, ...options.fdaMetadata },
  };

  const warnings: string[] = [];

  // Build leaf entries with checksums
  const { leaves, warnings: leafWarnings } = await buildLeafEntries(
    manifest,
    fullOptions
  );
  warnings.push(...leafWarnings);

  // Build configuration and metadata
  const config = buildConfig(fullOptions);
  const metadata = buildMetadata(manifest, fullOptions);
  const sequence = buildSequence(fullOptions);

  // Generate index.xml
  const indexXml = generateIndexXml(metadata, sequence, leaves, config);

  // Generate regional XML based on region
  let regionalXml = '';
  if (config.region === 'us') {
    // Build FDA-specific metadata
    const fdaMetadata: FdaMetadata = {
      ...metadata,
      fdaApplicationType: fullOptions.fdaMetadata.fdaApplicationType,
      submissionSubType: fullOptions.fdaMetadata.submissionSubType,
      dunsNumber: fullOptions.fdaMetadata.dunsNumber,
      establishmentId: fullOptions.fdaMetadata.establishmentId,
      contact: fullOptions.fdaMetadata.contact,
      coverLetterRef: fullOptions.fdaMetadata.coverLetterRef,
      form356hRef: fullOptions.fdaMetadata.form356hRef,
    };

    regionalXml = generateUsRegionalXml(fdaMetadata, sequence, leaves, config);
  }

  return {
    indexXml,
    regionalXml,
    leafEntries: leaves,
    warnings,
  };
}

/**
 * Format a sequence number with zero-padding
 *
 * @param num - The sequence number
 * @returns Zero-padded string (e.g., "0000", "0001")
 */
export function formatSequenceNumber(num: number): string {
  return num.toString().padStart(4, '0');
}

/**
 * Parse a sequence number string to integer
 *
 * @param seq - The sequence string (e.g., "0001")
 * @returns The integer value
 */
export function parseSequenceNumber(seq: string): number {
  return parseInt(seq, 10);
}

/**
 * Get the next sequence number
 *
 * @param currentSequence - Current sequence string
 * @returns Next sequence string
 */
export function getNextSequence(currentSequence: string): string {
  const current = parseSequenceNumber(currentSequence);
  return formatSequenceNumber(current + 1);
}

/**
 * Validate sequence number format
 *
 * @param seq - The sequence string to validate
 * @returns True if valid (4 digits, 0000-9999)
 */
export function isValidSequence(seq: string): boolean {
  return /^[0-9]{4}$/.test(seq);
}

/**
 * Determine submission type based on sequence
 *
 * @param sequence - Sequence number string
 * @returns Submission type
 */
export function determineSubmissionType(sequence: string): SubmissionType {
  const num = parseSequenceNumber(sequence);
  return num === 0 ? 'original' : 'amendment';
}
