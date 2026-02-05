/**
 * eCTD index.xml Template Builder
 *
 * Generates the main index.xml file for eCTD submissions.
 * This is the backbone file that defines the complete submission structure.
 *
 * Reference: ICH eCTD v4.0 specification
 */

import type {
  LeafEntry,
  SequenceInfo,
  SubmissionMetadata,
  EctdXmlConfig,
} from '../types';

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date as YYYY-MM-DD for XML
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Generate the XML declaration and DTD reference
 */
function generateXmlHeader(config: EctdXmlConfig): string {
  const lines: string[] = [];

  lines.push(`<?xml version="1.0" encoding="${config.encoding}"?>`);

  if (config.includeDtd) {
    // eCTD 4.0 uses XSD, but we include DTD reference for compatibility
    lines.push(`<!DOCTYPE ectd:ectd SYSTEM "ich-ectd-${config.dtdVersion}.dtd">`);
  }

  return lines.join('\n');
}

/**
 * Generate the root eCTD element with namespaces
 */
function generateRootElement(config: EctdXmlConfig): string {
  const namespaces = [
    'xmlns:ectd="http://www.ich.org/ectd"',
    'xmlns:xlink="http://www.w3.org/1999/xlink"',
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
  ];

  // Add regional namespace if needed
  if (config.region === 'us') {
    namespaces.push('xmlns:fda="http://www.fda.gov/cder/ectd"');
  }

  return `<ectd:ectd ${namespaces.join(' ')}>`;
}

/**
 * Build module structure based on eCTD modules
 *
 * eCTD structure:
 * - Module 1: Administrative Information and Prescribing Information (Regional)
 * - Module 2: Common Technical Document Summaries
 * - Module 3: Quality
 * - Module 4: Nonclinical Study Reports
 * - Module 5: Clinical Study Reports
 */
interface ModuleContent {
  title: string;
  leaves: LeafEntry[];
}

/**
 * Group leaf entries by eCTD module
 */
function groupLeavesByModule(leaves: LeafEntry[]): Map<string, ModuleContent> {
  const modules = new Map<string, ModuleContent>();

  // Initialize standard modules
  modules.set('m1', { title: 'Administrative Information', leaves: [] });
  modules.set('m2', { title: 'CTD Summaries', leaves: [] });
  modules.set('m3', { title: 'Quality', leaves: [] });
  modules.set('m4', { title: 'Nonclinical Study Reports', leaves: [] });
  modules.set('m5', { title: 'Clinical Study Reports', leaves: [] });

  for (const leaf of leaves) {
    // Determine module from href path
    const pathParts = leaf.href.split('/');
    const moduleKey = pathParts[0]?.toLowerCase() || 'm5';

    // If module doesn't exist (custom structure), use m5
    if (!modules.has(moduleKey)) {
      modules.get('m5')!.leaves.push(leaf);
    } else {
      modules.get(moduleKey)!.leaves.push(leaf);
    }
  }

  return modules;
}

/**
 * Generate a leaf element
 */
function generateLeafElement(leaf: LeafEntry, indent: string): string {
  const attrs: string[] = [
    `ID="${escapeXml(leaf.id)}"`,
    `xlink:href="${escapeXml(leaf.href)}"`,
    `checksum="${leaf.checksum}"`,
    `checksum-type="${leaf.checksumType}"`,
  ];

  if (leaf.operation) {
    attrs.push(`operation="${leaf.operation}"`);
  }

  if (leaf.modifiedFile) {
    attrs.push(`modified-file="${escapeXml(leaf.modifiedFile)}"`);
  }

  const title = escapeXml(leaf.title);

  return `${indent}<leaf ${attrs.join(' ')}>
${indent}  <title>${title}</title>
${indent}</leaf>`;
}

/**
 * Build section hierarchy from leaf entries
 *
 * Groups leaves into nested sections based on their node codes.
 * E.g., leaves with codes 16.2.1 and 16.2.2 go under section 16.2
 */
interface SectionNode {
  code: string;
  title: string;
  leaves: LeafEntry[];
  children: Map<string, SectionNode>;
}

function buildSectionTree(leaves: LeafEntry[]): SectionNode {
  const root: SectionNode = {
    code: '',
    title: 'Root',
    leaves: [],
    children: new Map(),
  };

  for (const leaf of leaves) {
    const codeParts = leaf.nodeCode.split('.');
    let current = root;

    // Navigate/create path to this leaf's section
    let currentCode = '';
    for (let i = 0; i < codeParts.length - 1; i++) {
      currentCode = currentCode ? `${currentCode}.${codeParts[i]}` : codeParts[i];

      if (!current.children.has(currentCode)) {
        current.children.set(currentCode, {
          code: currentCode,
          title: `Section ${currentCode}`,
          leaves: [],
          children: new Map(),
        });
      }
      current = current.children.get(currentCode)!;
    }

    // Add leaf to its parent section
    current.leaves.push(leaf);
  }

  return root;
}

/**
 * Generate XML for a section and its children
 */
function generateSectionXml(
  section: SectionNode,
  indent: string,
  prettyPrint: boolean
): string {
  const lines: string[] = [];
  const childIndent = prettyPrint ? indent + '  ' : '';
  const newline = prettyPrint ? '\n' : '';

  // Sort children by code
  const sortedChildren = Array.from(section.children.values()).sort((a, b) => {
    const aParts = a.code.split('.').map(Number);
    const bParts = b.code.split('.').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      if ((aParts[i] || 0) !== (bParts[i] || 0)) {
        return (aParts[i] || 0) - (bParts[i] || 0);
      }
    }
    return 0;
  });

  // Generate child sections (recursive call handles their leaves)
  for (const child of sortedChildren) {
    if (child.leaves.length > 0 || child.children.size > 0) {
      lines.push(`${indent}<section ID="s-${child.code.replace(/\./g, '-')}">`);
      lines.push(`${childIndent}<title>${escapeXml(child.title)}</title>`);

      // Recurse - this handles subsections AND leaves for the child
      const childContent = generateSectionXml(child, childIndent, prettyPrint);
      if (childContent) {
        lines.push(childContent);
      }

      lines.push(`${indent}</section>`);
    }
  }

  // Add leaves at THIS section level (after child sections)
  for (const leaf of section.leaves) {
    lines.push(generateLeafElement(leaf, indent));
  }

  return lines.join(newline);
}

/**
 * Generate module element with its content
 */
function generateModuleXml(
  moduleKey: string,
  moduleContent: ModuleContent,
  config: EctdXmlConfig
): string {
  if (moduleContent.leaves.length === 0) {
    return '';
  }

  const lines: string[] = [];
  const indent = config.prettyPrint ? '    ' : '';
  const newline = config.prettyPrint ? '\n' : '';

  // Build section tree for this module
  const sectionTree = buildSectionTree(moduleContent.leaves);

  lines.push(`  <${moduleKey} ID="${moduleKey}">`);
  lines.push(`${indent}<title>${escapeXml(moduleContent.title)}</title>`);

  // Generate sections
  const sectionsXml = generateSectionXml(sectionTree, indent, config.prettyPrint);
  if (sectionsXml) {
    lines.push(sectionsXml);
  }

  lines.push(`  </${moduleKey}>`);

  return lines.join(newline);
}

/**
 * Generate the complete index.xml content
 */
export function generateIndexXml(
  metadata: SubmissionMetadata,
  sequence: SequenceInfo,
  leaves: LeafEntry[],
  config: EctdXmlConfig
): string {
  const lines: string[] = [];
  const newline = config.prettyPrint ? '\n' : '';

  // XML header
  lines.push(generateXmlHeader(config));

  // Root element
  lines.push(generateRootElement(config));

  // Submission header
  lines.push('  <submission>');
  lines.push(`    <sequence>${escapeXml(sequence.number)}</sequence>`);
  lines.push(`    <submission-type>${escapeXml(sequence.type)}</submission-type>`);
  if (sequence.description) {
    lines.push(`    <submission-description>${escapeXml(sequence.description)}</submission-description>`);
  }
  if (sequence.relatedSequence) {
    lines.push(`    <related-sequence>${escapeXml(sequence.relatedSequence)}</related-sequence>`);
  }
  lines.push(`    <submission-date>${formatDate(metadata.submissionDate)}</submission-date>`);
  lines.push('  </submission>');

  // Applicant/sponsor info
  lines.push('  <applicant>');
  lines.push(`    <name>${escapeXml(metadata.sponsor)}</name>`);
  if (metadata.applicationNumber) {
    lines.push(`    <application-number>${escapeXml(metadata.applicationNumber)}</application-number>`);
  }
  if (metadata.applicationType) {
    lines.push(`    <application-type>${escapeXml(metadata.applicationType)}</application-type>`);
  }
  lines.push('  </applicant>');

  // Study info
  lines.push('  <study>');
  lines.push(`    <study-number>${escapeXml(metadata.studyNumber)}</study-number>`);
  if (metadata.productName) {
    lines.push(`    <product-name>${escapeXml(metadata.productName)}</product-name>`);
  }
  if (metadata.genericName) {
    lines.push(`    <generic-name>${escapeXml(metadata.genericName)}</generic-name>`);
  }
  if (metadata.therapeuticArea) {
    lines.push(`    <therapeutic-area>${escapeXml(metadata.therapeuticArea)}</therapeutic-area>`);
  }
  if (metadata.manufacturer) {
    lines.push(`    <manufacturer>${escapeXml(metadata.manufacturer)}</manufacturer>`);
  }
  lines.push('  </study>');

  // Group leaves by module
  const modules = groupLeavesByModule(leaves);

  // Generate each module with content
  const moduleOrder = ['m1', 'm2', 'm3', 'm4', 'm5'];
  for (const moduleKey of moduleOrder) {
    const moduleContent = modules.get(moduleKey);
    if (moduleContent && moduleContent.leaves.length > 0) {
      lines.push(generateModuleXml(moduleKey, moduleContent, config));
    }
  }

  // Close root element
  lines.push('</ectd:ectd>');

  return lines.join(newline);
}

/**
 * Generate a minimal index.xml for validation testing
 */
export function generateMinimalIndexXml(studyNumber: string): string {
  const config = {
    ectdVersion: '4.0',
    dtdVersion: '3.3',
    region: 'us' as const,
    includeDtd: true,
    encoding: 'UTF-8',
    prettyPrint: true,
  };

  const metadata: SubmissionMetadata = {
    sponsor: 'Unknown',
    studyNumber,
    submissionDate: new Date(),
  };

  const sequence: SequenceInfo = {
    number: '0000',
    type: 'original',
  };

  return generateIndexXml(metadata, sequence, [], config);
}
