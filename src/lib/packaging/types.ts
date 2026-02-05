/**
 * Package Assembly Types
 *
 * Type definitions for the eCTD package assembly system.
 * Defines structures for package manifests, readiness checks, and folder structures.
 */

/**
 * Package manifest entry for a single file
 */
export interface PackageFile {
  /** Database ID of the source document */
  sourceDocumentId: string;
  /** Path in uploads/ storage */
  sourcePath: string;
  /** Target path in eCTD package (e.g., m5/datasets/16-2-1/file.pdf) */
  targetPath: string;
  /** Structure node code (e.g., "16.2.1") */
  nodeCode: string;
  /** Structure node title */
  nodeTitle: string;
  /** Final sanitized file name */
  fileName: string;
  /** Document version */
  version: number;
  /** Page count if known */
  pageCount?: number;
  /** File size in bytes */
  fileSize: number;
}

/**
 * A structure node that is missing its required document
 */
export interface MissingRequiredNode {
  /** Structure node code */
  code: string;
  /** Structure node title */
  title: string;
  /** Structure node ID */
  nodeId: string;
}

/**
 * A document that is pending approval
 */
export interface PendingDocument {
  /** Document database ID */
  documentId: string;
  /** Original file name */
  fileName: string;
  /** Current status */
  status: string;
  /** Structure node code */
  nodeCode: string;
  /** Structure node title */
  nodeTitle: string;
}

/**
 * Readiness check result
 */
export interface ReadinessCheck {
  /** Whether the study is ready for packaging */
  ready: boolean;
  /** Required nodes that don't have approved documents */
  missingRequired: MissingRequiredNode[];
  /** Documents that exist but aren't approved/published yet */
  pendingApproval: PendingDocument[];
  /** Count of validation errors across all documents */
  validationErrors: number;
  /** Count of unresolved CORRECTION_REQUIRED annotations */
  unresolvedAnnotations: number;
  /** Total number of files that will be included */
  totalFiles: number;
  /** Total number of required nodes in the template */
  totalRequiredNodes: number;
}

/**
 * Folder tree node for the eCTD package structure
 */
export interface FolderNode {
  /** Folder name */
  name: string;
  /** Full path from package root */
  path: string;
  /** Child folders */
  children: FolderNode[];
  /** File names at this level */
  files: string[];
}

/**
 * Full package manifest
 */
export interface PackageManifest {
  /** Study database ID */
  studyId: string;
  /** Protocol/study number */
  studyNumber: string;
  /** When the manifest was generated */
  generatedAt: Date;
  /** List of files to include in the package */
  files: PackageFile[];
  /** Readiness check results */
  readiness: ReadinessCheck;
  /** Folder structure tree */
  folderStructure: FolderNode[];
}

/**
 * Options for package assembly
 */
export interface AssemblyOptions {
  /** Include documents that are APPROVED (not yet published) */
  includeApproved?: boolean;
  /** Include documents that are PUBLISHED */
  includePublished?: boolean;
  /** Include draft documents (for preview purposes only) */
  includeDrafts?: boolean;
}

// ============ eCTD XML Types ============

/**
 * Submission type for eCTD
 */
export type SubmissionType = 'original' | 'amendment' | 'supplement';

/**
 * Regional submission format
 */
export type RegionalFormat = 'us' | 'eu' | 'ich';

/**
 * Leaf operation type for amendments
 */
export type LeafOperation = 'new' | 'replace' | 'delete' | 'append';

/**
 * Leaf entry in eCTD XML
 * Represents a single file in the submission
 */
export interface LeafEntry {
  /** Unique ID for this leaf (e.g., "us-1-1-1") */
  id: string;
  /** Relative path from package root (forward slashes) */
  href: string;
  /** MD5 checksum of the file */
  checksum: string;
  /** Checksum algorithm (always "md5" for eCTD) */
  checksumType: 'md5';
  /** File size in bytes */
  fileSize: number;
  /** Operation type (for amendments) */
  operation?: LeafOperation;
  /** Modified file reference (for replace operations) */
  modifiedFile?: string;
  /** Title/description */
  title: string;
  /** Structure node code (e.g., "16.2.1") */
  nodeCode: string;
}

/**
 * Sequence information for submission tracking
 */
export interface SequenceInfo {
  /** Sequence number (0000 for original, 0001+ for amendments) */
  number: string;
  /** Type of submission */
  type: SubmissionType;
  /** Description/reason for this sequence */
  description?: string;
  /** Related sequences (for amendments referencing original) */
  relatedSequence?: string;
}

/**
 * Metadata for the submission
 */
export interface SubmissionMetadata {
  /** Sponsor company name */
  sponsor: string;
  /** Protocol/study number */
  studyNumber: string;
  /** Application number (NDA, IND, etc.) */
  applicationNumber?: string;
  /** Application type (e.g., "NDA", "IND", "BLA") */
  applicationType?: string;
  /** Therapeutic area */
  therapeuticArea?: string;
  /** Drug/product name */
  productName?: string;
  /** Generic name */
  genericName?: string;
  /** Manufacturer */
  manufacturer?: string;
  /** Submission date */
  submissionDate: Date;
}

/**
 * Configuration for eCTD XML generation
 */
export interface EctdXmlConfig {
  /** eCTD specification version (default: "4.0") */
  ectdVersion: string;
  /** DTD version for index.xml */
  dtdVersion: string;
  /** Regional format */
  region: RegionalFormat;
  /** Include DTD declaration in XML */
  includeDtd: boolean;
  /** XML encoding */
  encoding: string;
  /** Indent XML for readability */
  prettyPrint: boolean;
}

/**
 * Default eCTD XML configuration
 */
export const DEFAULT_ECTD_CONFIG: EctdXmlConfig = {
  ectdVersion: '4.0',
  dtdVersion: '3.3',
  region: 'us',
  includeDtd: true,
  encoding: 'UTF-8',
  prettyPrint: true,
};

/**
 * Result of XML generation
 */
export interface XmlGenerationResult {
  /** index.xml content */
  indexXml: string;
  /** Regional XML content (us-regional.xml, etc.) */
  regionalXml: string;
  /** List of leaf entries included */
  leafEntries: LeafEntry[];
  /** Warnings during generation */
  warnings: string[];
}

/**
 * Default assembly options
 */
export const DEFAULT_ASSEMBLY_OPTIONS: AssemblyOptions = {
  includeApproved: true,
  includePublished: true,
  includeDrafts: false,
};

// ============ Cover Page Types ============

/**
 * Configuration for cover page generation
 */
export interface CoverPageConfig {
  /** Page width in points (default: 612 - US Letter) */
  pageWidth?: number;
  /** Page height in points (default: 792 - US Letter) */
  pageHeight?: number;
  /** Page margins in points */
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  /** Font sizes in points */
  fontSize?: {
    title: number;
    heading: number;
    body: number;
    small: number;
  };
  /** Include bookmarks in the cover page PDF */
  includeBookmarks?: boolean;
  /** Line height multiplier (default: 1.4) */
  lineHeight?: number;
}

/**
 * Study metadata for cover page header
 */
export interface CoverPageMetadata {
  /** Protocol/study number */
  studyNumber: string;
  /** Sponsor company name */
  sponsor: string;
  /** Therapeutic area */
  therapeuticArea?: string;
  /** Study phase */
  phase?: string;
  /** Application number (NDA, IND, etc.) */
  applicationNumber?: string;
  /** Application type */
  applicationType?: string;
  /** Drug/product name */
  productName?: string;
  /** Submission type description */
  submissionType: string;
  /** Sequence number (0000, 0001, etc.) */
  sequenceNumber: string;
  /** Generation timestamp */
  generatedAt: Date;
}

/**
 * Table of contents entry
 */
export interface TocEntry {
  /** Display title (e.g., "16.2.1 - Demographics Listing") */
  title: string;
  /** Indentation level (0 = root) */
  level: number;
  /** Target file path relative to eCTD root */
  targetPath: string;
  /** Page count of the target document */
  pageCount?: number;
  /** Child entries */
  children?: TocEntry[];
}

/**
 * Result of cover page generation
 */
export interface CoverPageResult {
  /** PDF bytes */
  pdfBytes: Uint8Array;
  /** Target path in eCTD structure (m1/us/cover.pdf) */
  targetPath: string;
  /** Number of TOC entries with hyperlinks */
  linkCount: number;
  /** Number of bookmarks added */
  bookmarkCount: number;
  /** Any warnings during generation */
  warnings: string[];
}

/**
 * Default cover page configuration
 */
export const DEFAULT_COVER_PAGE_CONFIG: CoverPageConfig = {
  pageWidth: 612,
  pageHeight: 792,
  margins: {
    top: 72,
    bottom: 72,
    left: 72,
    right: 72,
  },
  fontSize: {
    title: 18,
    heading: 14,
    body: 11,
    small: 9,
  },
  includeBookmarks: true,
  lineHeight: 1.4,
};
