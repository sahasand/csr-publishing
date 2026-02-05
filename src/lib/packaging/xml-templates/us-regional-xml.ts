/**
 * FDA US Regional XML Template Builder
 *
 * Generates the us-regional.xml file for FDA submissions.
 * This file contains US-specific Module 1 administrative information.
 *
 * Reference: FDA eCTD Technical Conformance Guide
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
 * FDA application types
 */
export type FdaApplicationType =
  | 'nda'      // New Drug Application
  | 'anda'     // Abbreviated New Drug Application
  | 'bla'      // Biologics License Application
  | 'ind'      // Investigational New Drug
  | 'nda-supplement'
  | 'anda-supplement'
  | 'bla-supplement'
  | 'ind-amendment';

/**
 * FDA submission sub-type
 */
export type FdaSubmissionSubType =
  | 'original'
  | 'amendment'
  | 'supplement'
  | 'annual-report'
  | 'resubmission'
  | 'pre-submission';

/**
 * FDA-specific metadata
 */
export interface FdaMetadata extends SubmissionMetadata {
  /** FDA application type */
  fdaApplicationType?: FdaApplicationType;
  /** Submission sub-type */
  submissionSubType?: FdaSubmissionSubType;
  /** DUNS number */
  dunsNumber?: string;
  /** Establishment ID */
  establishmentId?: string;
  /** Contact information */
  contact?: {
    name: string;
    phone?: string;
    email?: string;
    fax?: string;
  };
  /** Cover letter reference */
  coverLetterRef?: string;
  /** Form FDA 356h reference */
  form356hRef?: string;
}

/**
 * Generate XML header for US regional file
 */
function generateXmlHeader(config: EctdXmlConfig): string {
  const lines: string[] = [];

  lines.push(`<?xml version="1.0" encoding="${config.encoding}"?>`);

  if (config.includeDtd) {
    lines.push('<!DOCTYPE fda:fda SYSTEM "us-regional.dtd">');
  }

  return lines.join('\n');
}

/**
 * Generate Module 1.1 - Forms section
 */
function generateFormsSection(
  metadata: FdaMetadata,
  leaves: LeafEntry[],
  indent: string
): string[] {
  const lines: string[] = [];

  // Filter M1 form leaves
  const formLeaves = leaves.filter(
    (l) => l.href.startsWith('m1/') && l.href.includes('form')
  );

  if (formLeaves.length === 0 && !metadata.form356hRef) {
    return lines;
  }

  lines.push(`${indent}<m1-1-forms>`);
  lines.push(`${indent}  <title>Forms</title>`);

  // FDA Form 356h (required for most submissions)
  if (metadata.form356hRef) {
    lines.push(`${indent}  <form-356h>`);
    lines.push(`${indent}    <leaf-ref idref="${escapeXml(metadata.form356hRef)}" />`);
    lines.push(`${indent}  </form-356h>`);
  }

  for (const leaf of formLeaves) {
    lines.push(`${indent}  <leaf ID="${escapeXml(leaf.id)}" xlink:href="${escapeXml(leaf.href)}" checksum="${leaf.checksum}" checksum-type="md5">`);
    lines.push(`${indent}    <title>${escapeXml(leaf.title)}</title>`);
    lines.push(`${indent}  </leaf>`);
  }

  lines.push(`${indent}</m1-1-forms>`);

  return lines;
}

/**
 * Generate Module 1.2 - Cover Letter section
 */
function generateCoverLetterSection(
  metadata: FdaMetadata,
  leaves: LeafEntry[],
  indent: string
): string[] {
  const lines: string[] = [];

  // Filter cover letter leaves
  const coverLeaves = leaves.filter(
    (l) => l.href.startsWith('m1/') && l.href.includes('cover')
  );

  if (coverLeaves.length === 0 && !metadata.coverLetterRef) {
    return lines;
  }

  lines.push(`${indent}<m1-2-cover-letter>`);
  lines.push(`${indent}  <title>Cover Letter</title>`);

  if (metadata.coverLetterRef) {
    lines.push(`${indent}  <leaf-ref idref="${escapeXml(metadata.coverLetterRef)}" />`);
  }

  for (const leaf of coverLeaves) {
    lines.push(`${indent}  <leaf ID="${escapeXml(leaf.id)}" xlink:href="${escapeXml(leaf.href)}" checksum="${leaf.checksum}" checksum-type="md5">`);
    lines.push(`${indent}    <title>${escapeXml(leaf.title)}</title>`);
    lines.push(`${indent}  </leaf>`);
  }

  lines.push(`${indent}</m1-2-cover-letter>`);

  return lines;
}

/**
 * Generate Module 1.3 - Administrative Information section
 */
function generateAdminSection(
  metadata: FdaMetadata,
  indent: string
): string[] {
  const lines: string[] = [];

  lines.push(`${indent}<m1-3-administrative-information>`);
  lines.push(`${indent}  <title>Administrative Information</title>`);

  // Contact information
  if (metadata.contact) {
    lines.push(`${indent}  <contact>`);
    lines.push(`${indent}    <name>${escapeXml(metadata.contact.name)}</name>`);
    if (metadata.contact.phone) {
      lines.push(`${indent}    <phone>${escapeXml(metadata.contact.phone)}</phone>`);
    }
    if (metadata.contact.email) {
      lines.push(`${indent}    <email>${escapeXml(metadata.contact.email)}</email>`);
    }
    if (metadata.contact.fax) {
      lines.push(`${indent}    <fax>${escapeXml(metadata.contact.fax)}</fax>`);
    }
    lines.push(`${indent}  </contact>`);
  }

  // DUNS number
  if (metadata.dunsNumber) {
    lines.push(`${indent}  <duns-number>${escapeXml(metadata.dunsNumber)}</duns-number>`);
  }

  // Establishment ID
  if (metadata.establishmentId) {
    lines.push(`${indent}  <establishment-id>${escapeXml(metadata.establishmentId)}</establishment-id>`);
  }

  lines.push(`${indent}</m1-3-administrative-information>`);

  return lines;
}

/**
 * Generate the complete us-regional.xml content
 */
export function generateUsRegionalXml(
  metadata: FdaMetadata,
  sequence: SequenceInfo,
  leaves: LeafEntry[],
  config: EctdXmlConfig
): string {
  const lines: string[] = [];
  const newline = config.prettyPrint ? '\n' : '';
  const indent = config.prettyPrint ? '  ' : '';

  // XML header
  lines.push(generateXmlHeader(config));

  // Root element with namespaces
  lines.push('<fda:fda xmlns:fda="http://www.fda.gov/cder/ectd" xmlns:xlink="http://www.w3.org/1999/xlink">');

  // Header section
  lines.push(`${indent}<header>`);
  lines.push(`${indent}${indent}<submission-info>`);
  lines.push(`${indent}${indent}${indent}<sequence-number>${escapeXml(sequence.number)}</sequence-number>`);

  if (metadata.fdaApplicationType) {
    lines.push(`${indent}${indent}${indent}<application-type>${escapeXml(metadata.fdaApplicationType)}</application-type>`);
  }

  if (metadata.submissionSubType) {
    lines.push(`${indent}${indent}${indent}<submission-sub-type>${escapeXml(metadata.submissionSubType)}</submission-sub-type>`);
  }

  if (metadata.applicationNumber) {
    lines.push(`${indent}${indent}${indent}<application-number>${escapeXml(metadata.applicationNumber)}</application-number>`);
  }

  lines.push(`${indent}${indent}${indent}<submission-date>${formatDate(metadata.submissionDate)}</submission-date>`);
  lines.push(`${indent}${indent}</submission-info>`);

  // Applicant info
  lines.push(`${indent}${indent}<applicant-info>`);
  lines.push(`${indent}${indent}${indent}<applicant-name>${escapeXml(metadata.sponsor)}</applicant-name>`);

  if (metadata.dunsNumber) {
    lines.push(`${indent}${indent}${indent}<duns-number>${escapeXml(metadata.dunsNumber)}</duns-number>`);
  }

  lines.push(`${indent}${indent}</applicant-info>`);

  // Product info
  if (metadata.productName || metadata.genericName) {
    lines.push(`${indent}${indent}<product-info>`);
    if (metadata.productName) {
      lines.push(`${indent}${indent}${indent}<product-name>${escapeXml(metadata.productName)}</product-name>`);
    }
    if (metadata.genericName) {
      lines.push(`${indent}${indent}${indent}<generic-name>${escapeXml(metadata.genericName)}</generic-name>`);
    }
    lines.push(`${indent}${indent}</product-info>`);
  }

  lines.push(`${indent}</header>`);

  // Module 1 content
  lines.push(`${indent}<m1-us-regional ID="m1-us">`);
  lines.push(`${indent}${indent}<title>US Regional Administrative Information</title>`);

  // M1.1 - Forms
  const formsSection = generateFormsSection(metadata, leaves, indent + indent);
  lines.push(...formsSection);

  // M1.2 - Cover Letter
  const coverSection = generateCoverLetterSection(metadata, leaves, indent + indent);
  lines.push(...coverSection);

  // M1.3 - Administrative Information
  const adminSection = generateAdminSection(metadata, indent + indent);
  lines.push(...adminSection);

  // Add any other M1 leaves not categorized above
  const otherM1Leaves = leaves.filter(
    (l) =>
      l.href.startsWith('m1/') &&
      !l.href.includes('form') &&
      !l.href.includes('cover')
  );

  if (otherM1Leaves.length > 0) {
    lines.push(`${indent}${indent}<m1-other>`);
    lines.push(`${indent}${indent}${indent}<title>Other Regional Documents</title>`);

    for (const leaf of otherM1Leaves) {
      lines.push(`${indent}${indent}${indent}<leaf ID="${escapeXml(leaf.id)}" xlink:href="${escapeXml(leaf.href)}" checksum="${leaf.checksum}" checksum-type="md5">`);
      lines.push(`${indent}${indent}${indent}${indent}<title>${escapeXml(leaf.title)}</title>`);
      lines.push(`${indent}${indent}${indent}</leaf>`);
    }

    lines.push(`${indent}${indent}</m1-other>`);
  }

  lines.push(`${indent}</m1-us-regional>`);

  // Close root element
  lines.push('</fda:fda>');

  return lines.join(newline);
}

/**
 * Generate a minimal US regional XML
 */
export function generateMinimalUsRegionalXml(
  sponsor: string,
  submissionDate: Date
): string {
  const config: EctdXmlConfig = {
    ectdVersion: '4.0',
    dtdVersion: '3.3',
    region: 'us',
    includeDtd: true,
    encoding: 'UTF-8',
    prettyPrint: true,
  };

  const metadata: FdaMetadata = {
    sponsor,
    studyNumber: 'UNKNOWN',
    submissionDate,
  };

  const sequence: SequenceInfo = {
    number: '0000',
    type: 'original',
  };

  return generateUsRegionalXml(metadata, sequence, [], config);
}
