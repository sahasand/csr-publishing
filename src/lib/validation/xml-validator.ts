/**
 * eCTD XML Validator
 *
 * Validates generated eCTD XML files against structural requirements.
 * Performs semantic validation without requiring full XSD/DTD parsing.
 *
 * Checks:
 * - Required elements present
 * - Proper element nesting
 * - Attribute validation (checksums, IDs, hrefs)
 * - Cross-reference validation (leaf hrefs match actual files)
 */

import type { PackageFile, LeafEntry } from '@/lib/packaging/types';

/**
 * Severity for XML validation issues
 */
export type XmlValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

/**
 * Single XML validation issue
 */
export interface XmlValidationIssue {
  /** Severity level */
  severity: XmlValidationSeverity;
  /** Validation rule that failed */
  rule: string;
  /** Human-readable message */
  message: string;
  /** Element path where issue was found (if applicable) */
  elementPath?: string;
  /** Line number (if applicable) */
  lineNumber?: number;
}

/**
 * Result of XML validation
 */
export interface XmlValidationResult {
  /** Whether validation passed (no errors) */
  valid: boolean;
  /** XML type validated */
  xmlType: 'index' | 'us-regional' | 'unknown';
  /** All issues found */
  issues: XmlValidationIssue[];
  /** Error count */
  errorCount: number;
  /** Warning count */
  warningCount: number;
  /** Extracted metadata (if validation succeeded) */
  metadata?: {
    sequence?: string;
    submissionType?: string;
    studyNumber?: string;
    sponsor?: string;
    leafCount?: number;
  };
}

/**
 * Options for XML validation
 */
export interface XmlValidationOptions {
  /** Package files for cross-reference validation */
  packageFiles?: PackageFile[];
  /** Leaf entries for reference validation */
  leafEntries?: LeafEntry[];
  /** Skip checksum format validation */
  skipChecksumValidation?: boolean;
  /** Allow empty modules */
  allowEmptyModules?: boolean;
}

/**
 * Required elements in index.xml
 */
const REQUIRED_INDEX_ELEMENTS = [
  'ectd:ectd',
  'submission',
  'sequence',
  'submission-type',
  'submission-date',
  'applicant',
  'name',
  'study',
  'study-number',
];

/**
 * Required attributes for leaf elements
 */
const REQUIRED_LEAF_ATTRIBUTES = [
  'ID',
  'xlink:href',
  'checksum',
  'checksum-type',
];

/**
 * Valid eCTD modules
 */
const VALID_MODULES = ['m1', 'm2', 'm3', 'm4', 'm5'];

/**
 * MD5 checksum regex pattern (32 hex characters)
 */
const MD5_PATTERN = /^[a-f0-9]{32}$/i;

/**
 * Validate index.xml content
 *
 * @param xmlContent - The XML content to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateIndexXml(
  xmlContent: string,
  options: XmlValidationOptions = {}
): XmlValidationResult {
  const issues: XmlValidationIssue[] = [];
  const metadata: XmlValidationResult['metadata'] = {};

  // Check for XML declaration
  if (!xmlContent.startsWith('<?xml')) {
    issues.push({
      severity: 'ERROR',
      rule: 'xml-declaration',
      message: 'Missing XML declaration',
    });
  }

  // Check for root element
  if (!xmlContent.includes('<ectd:ectd')) {
    issues.push({
      severity: 'ERROR',
      rule: 'root-element',
      message: 'Missing root element <ectd:ectd>',
    });
    return buildResult(issues, 'index', metadata);
  }

  // Check required elements
  for (const element of REQUIRED_INDEX_ELEMENTS) {
    const pattern = new RegExp(`<${element}[>\\s]`, 'i');
    if (!pattern.test(xmlContent)) {
      issues.push({
        severity: 'ERROR',
        rule: 'required-element',
        message: `Missing required element: <${element}>`,
        elementPath: element,
      });
    }
  }

  // Extract and validate sequence
  const sequenceMatch = xmlContent.match(/<sequence>([^<]+)<\/sequence>/);
  if (sequenceMatch) {
    metadata.sequence = sequenceMatch[1];
    if (!/^[0-9]{4}$/.test(sequenceMatch[1])) {
      issues.push({
        severity: 'ERROR',
        rule: 'sequence-format',
        message: `Invalid sequence format: ${sequenceMatch[1]} (expected 4 digits like "0000")`,
        elementPath: 'submission/sequence',
      });
    }
  }

  // Extract submission type
  const typeMatch = xmlContent.match(/<submission-type>([^<]+)<\/submission-type>/);
  if (typeMatch) {
    metadata.submissionType = typeMatch[1];
    const validTypes = ['original', 'amendment', 'supplement'];
    if (!validTypes.includes(typeMatch[1].toLowerCase())) {
      issues.push({
        severity: 'WARNING',
        rule: 'submission-type',
        message: `Unusual submission type: ${typeMatch[1]}`,
        elementPath: 'submission/submission-type',
      });
    }
  }

  // Extract study number
  const studyMatch = xmlContent.match(/<study-number>([^<]+)<\/study-number>/);
  if (studyMatch) {
    metadata.studyNumber = studyMatch[1];
  }

  // Extract sponsor
  const sponsorMatch = xmlContent.match(/<applicant>\s*<name>([^<]+)<\/name>/);
  if (sponsorMatch) {
    metadata.sponsor = sponsorMatch[1];
  }

  // Validate leaf elements
  const leafIssues = validateLeafElements(xmlContent, options);
  issues.push(...leafIssues.issues);
  metadata.leafCount = leafIssues.count;

  // Validate modules
  const moduleIssues = validateModules(xmlContent, options);
  issues.push(...moduleIssues);

  // Validate closing tag
  if (!xmlContent.includes('</ectd:ectd>')) {
    issues.push({
      severity: 'ERROR',
      rule: 'closing-tag',
      message: 'Missing closing tag </ectd:ectd>',
    });
  }

  // Check namespaces
  validateNamespaces(xmlContent, issues);

  return buildResult(issues, 'index', metadata);
}

/**
 * Validate us-regional.xml content
 *
 * @param xmlContent - The XML content to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateUsRegionalXml(
  xmlContent: string,
  options: XmlValidationOptions = {}
): XmlValidationResult {
  const issues: XmlValidationIssue[] = [];
  const metadata: XmlValidationResult['metadata'] = {};

  // Check for XML declaration
  if (!xmlContent.startsWith('<?xml')) {
    issues.push({
      severity: 'ERROR',
      rule: 'xml-declaration',
      message: 'Missing XML declaration',
    });
  }

  // Check for FDA regional root
  if (!xmlContent.includes('<fda:fda') && !xmlContent.includes('<us-regional')) {
    issues.push({
      severity: 'ERROR',
      rule: 'root-element',
      message: 'Missing FDA regional root element',
    });
    return buildResult(issues, 'us-regional', metadata);
  }

  // Check required FDA elements
  const requiredFdaElements = [
    'submission-type',
    'application-number',
  ];

  for (const element of requiredFdaElements) {
    // FDA elements might be under fda: namespace or not
    const pattern = new RegExp(`<(fda:)?${element}[>\\s]`, 'i');
    if (!pattern.test(xmlContent)) {
      issues.push({
        severity: 'WARNING',
        rule: 'fda-element',
        message: `Missing recommended FDA element: <${element}>`,
        elementPath: element,
      });
    }
  }

  // Validate leaf elements
  const leafIssues = validateLeafElements(xmlContent, options);
  issues.push(...leafIssues.issues);
  metadata.leafCount = leafIssues.count;

  return buildResult(issues, 'us-regional', metadata);
}

/**
 * Validate leaf elements in XML
 */
function validateLeafElements(
  xmlContent: string,
  options: XmlValidationOptions
): { issues: XmlValidationIssue[]; count: number } {
  const issues: XmlValidationIssue[] = [];

  // Find all leaf elements
  const leafPattern = /<leaf\s+([^>]+)>/g;
  const leaves: { attrs: string; fullMatch: string }[] = [];
  let match;

  while ((match = leafPattern.exec(xmlContent)) !== null) {
    leaves.push({
      attrs: match[1],
      fullMatch: match[0],
    });
  }

  // Validate each leaf
  const seenIds = new Set<string>();
  const seenHrefs = new Set<string>();

  for (const leaf of leaves) {
    // Check required attributes
    for (const attr of REQUIRED_LEAF_ATTRIBUTES) {
      const attrPattern = new RegExp(`${attr}\\s*=\\s*"[^"]*"`, 'i');
      if (!attrPattern.test(leaf.attrs)) {
        issues.push({
          severity: 'ERROR',
          rule: 'leaf-attribute',
          message: `Leaf element missing required attribute: ${attr}`,
          elementPath: 'leaf',
        });
      }
    }

    // Extract and validate ID
    const idMatch = leaf.attrs.match(/ID\s*=\s*"([^"]*)"/);
    if (idMatch) {
      const id = idMatch[1];
      if (seenIds.has(id)) {
        issues.push({
          severity: 'ERROR',
          rule: 'duplicate-id',
          message: `Duplicate leaf ID: ${id}`,
          elementPath: `leaf[@ID="${id}"]`,
        });
      }
      seenIds.add(id);
    }

    // Extract and validate href
    const hrefMatch = leaf.attrs.match(/xlink:href\s*=\s*"([^"]*)"/);
    if (hrefMatch) {
      const href = hrefMatch[1];

      // Check for duplicate hrefs
      if (seenHrefs.has(href)) {
        issues.push({
          severity: 'WARNING',
          rule: 'duplicate-href',
          message: `Duplicate leaf href: ${href}`,
          elementPath: `leaf[@href="${href}"]`,
        });
      }
      seenHrefs.add(href);

      // Check href format
      if (href.includes('\\')) {
        issues.push({
          severity: 'ERROR',
          rule: 'href-format',
          message: `Leaf href contains backslash (should use forward slash): ${href}`,
          elementPath: `leaf[@href="${href}"]`,
        });
      }

      // Cross-reference validation
      if (options.packageFiles) {
        const matchingFile = options.packageFiles.find(
          (f) => f.targetPath === href || f.targetPath.replace(/\\/g, '/') === href
        );
        if (!matchingFile) {
          issues.push({
            severity: 'ERROR',
            rule: 'href-reference',
            message: `Leaf href references non-existent file: ${href}`,
            elementPath: `leaf[@href="${href}"]`,
          });
        }
      }
    }

    // Validate checksum format
    if (!options.skipChecksumValidation) {
      const checksumMatch = leaf.attrs.match(/checksum\s*=\s*"([^"]*)"/);
      if (checksumMatch) {
        const checksum = checksumMatch[1];
        if (checksum && !MD5_PATTERN.test(checksum)) {
          issues.push({
            severity: 'ERROR',
            rule: 'checksum-format',
            message: `Invalid MD5 checksum format: ${checksum}`,
            elementPath: 'leaf',
          });
        }
      }
    }

    // Validate checksum-type
    const checksumTypeMatch = leaf.attrs.match(/checksum-type\s*=\s*"([^"]*)"/);
    if (checksumTypeMatch && checksumTypeMatch[1].toLowerCase() !== 'md5') {
      issues.push({
        severity: 'ERROR',
        rule: 'checksum-type',
        message: `Invalid checksum type: ${checksumTypeMatch[1]} (must be "md5")`,
        elementPath: 'leaf',
      });
    }
  }

  return { issues, count: leaves.length };
}

/**
 * Validate module elements
 */
function validateModules(
  xmlContent: string,
  options: XmlValidationOptions
): XmlValidationIssue[] {
  const issues: XmlValidationIssue[] = [];

  // Check for valid module elements
  for (const mod of VALID_MODULES) {
    const openPattern = new RegExp(`<${mod}\\s+[^>]*ID\\s*=\\s*"${mod}"`, 'i');
    const closePattern = new RegExp(`</${mod}>`, 'i');

    const hasOpen = openPattern.test(xmlContent);
    const hasClose = closePattern.test(xmlContent);

    if (hasOpen && !hasClose) {
      issues.push({
        severity: 'ERROR',
        rule: 'unclosed-module',
        message: `Module ${mod} is not properly closed`,
        elementPath: mod,
      });
    }
  }

  // Check for unrecognized modules
  const modulePattern = /<(m[0-9]+)\s+/g;
  let match;
  while ((match = modulePattern.exec(xmlContent)) !== null) {
    const moduleName = match[1].toLowerCase();
    if (!VALID_MODULES.includes(moduleName)) {
      issues.push({
        severity: 'WARNING',
        rule: 'unknown-module',
        message: `Unknown module: ${match[1]}`,
        elementPath: match[1],
      });
    }
  }

  return issues;
}

/**
 * Validate XML namespaces
 */
function validateNamespaces(
  xmlContent: string,
  issues: XmlValidationIssue[]
): void {
  // Check for required namespaces
  const requiredNamespaces = [
    { prefix: 'ectd', uri: 'ich.org/ectd' },
    { prefix: 'xlink', uri: 'w3.org/1999/xlink' },
  ];

  for (const ns of requiredNamespaces) {
    const pattern = new RegExp(`xmlns:${ns.prefix}\\s*=\\s*"[^"]*${ns.uri}`, 'i');
    if (!pattern.test(xmlContent)) {
      issues.push({
        severity: 'ERROR',
        rule: 'namespace',
        message: `Missing required namespace: xmlns:${ns.prefix}`,
        elementPath: 'ectd:ectd',
      });
    }
  }
}

/**
 * Build validation result
 */
function buildResult(
  issues: XmlValidationIssue[],
  xmlType: XmlValidationResult['xmlType'],
  metadata: XmlValidationResult['metadata']
): XmlValidationResult {
  const errorCount = issues.filter((i) => i.severity === 'ERROR').length;
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length;

  return {
    valid: errorCount === 0,
    xmlType,
    issues,
    errorCount,
    warningCount,
    metadata: Object.keys(metadata || {}).length > 0 ? metadata : undefined,
  };
}

/**
 * Validate both index.xml and regional XML together
 *
 * @param indexXml - The index.xml content
 * @param regionalXml - The regional XML content
 * @param options - Validation options
 * @returns Combined validation result
 */
export function validateEctdXml(
  indexXml: string,
  regionalXml: string,
  options: XmlValidationOptions = {}
): {
  indexResult: XmlValidationResult;
  regionalResult: XmlValidationResult;
  combinedValid: boolean;
  totalErrors: number;
  totalWarnings: number;
} {
  const indexResult = validateIndexXml(indexXml, options);
  const regionalResult = validateUsRegionalXml(regionalXml, options);

  return {
    indexResult,
    regionalResult,
    combinedValid: indexResult.valid && regionalResult.valid,
    totalErrors: indexResult.errorCount + regionalResult.errorCount,
    totalWarnings: indexResult.warningCount + regionalResult.warningCount,
  };
}

/**
 * Format XML validation issues as a report string
 */
export function formatXmlValidationReport(result: XmlValidationResult): string {
  const lines: string[] = [];

  lines.push(`XML Validation Report (${result.xmlType})`);
  lines.push('='.repeat(40));
  lines.push(`Status: ${result.valid ? 'VALID' : 'INVALID'}`);
  lines.push(`Errors: ${result.errorCount}, Warnings: ${result.warningCount}`);

  if (result.metadata) {
    lines.push('');
    lines.push('Metadata:');
    if (result.metadata.sequence) lines.push(`  Sequence: ${result.metadata.sequence}`);
    if (result.metadata.submissionType) lines.push(`  Type: ${result.metadata.submissionType}`);
    if (result.metadata.studyNumber) lines.push(`  Study: ${result.metadata.studyNumber}`);
    if (result.metadata.sponsor) lines.push(`  Sponsor: ${result.metadata.sponsor}`);
    if (result.metadata.leafCount !== undefined) lines.push(`  Leaves: ${result.metadata.leafCount}`);
  }

  if (result.issues.length > 0) {
    lines.push('');
    lines.push('Issues:');

    const errors = result.issues.filter((i) => i.severity === 'ERROR');
    const warnings = result.issues.filter((i) => i.severity === 'WARNING');

    if (errors.length > 0) {
      lines.push('');
      lines.push('  ERRORS:');
      for (const issue of errors) {
        const path = issue.elementPath ? ` [${issue.elementPath}]` : '';
        lines.push(`    - ${issue.message}${path}`);
      }
    }

    if (warnings.length > 0) {
      lines.push('');
      lines.push('  WARNINGS:');
      for (const issue of warnings) {
        const path = issue.elementPath ? ` [${issue.elementPath}]` : '';
        lines.push(`    - ${issue.message}${path}`);
      }
    }
  }

  return lines.join('\n');
}
