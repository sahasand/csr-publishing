/**
 * ICH E3 Module 16 Standard CSR Sections
 * These are the standard sections for Clinical Study Reports per regulatory guidelines.
 */

export type DocumentType = 'PDF' | 'LISTING' | 'DATASET';

export interface StandardSection {
  code: string;
  title: string;
  documentType: DocumentType;
  required: boolean;
  sortOrder: number;
}

export const STANDARD_CSR_SECTIONS: StandardSection[] = [
  { code: '16.1.1', title: 'Study Protocol and Amendments', documentType: 'PDF', required: true, sortOrder: 1 },
  { code: '16.1.2', title: 'Sample Case Report Form', documentType: 'PDF', required: true, sortOrder: 2 },
  { code: '16.1.3', title: 'Informed Consent Form', documentType: 'PDF', required: true, sortOrder: 3 },
  { code: '16.1.4', title: 'List of Investigators', documentType: 'PDF', required: false, sortOrder: 4 },
  { code: '16.1.5', title: 'Signatures of Principal Investigators', documentType: 'PDF', required: false, sortOrder: 5 },
  { code: '16.1.6', title: 'Listing of Patients Receiving Test Drug', documentType: 'LISTING', required: false, sortOrder: 6 },
  { code: '16.1.7', title: 'Randomization Scheme', documentType: 'PDF', required: false, sortOrder: 7 },
  { code: '16.1.8', title: 'Audit Certificates', documentType: 'PDF', required: false, sortOrder: 8 },
  { code: '16.1.9', title: 'Statistical Analysis Plan', documentType: 'PDF', required: true, sortOrder: 9 },
  { code: '16.2.1', title: 'Patient Demographics', documentType: 'DATASET', required: true, sortOrder: 10 },
  { code: '16.2.2', title: 'Protocol Deviations', documentType: 'LISTING', required: false, sortOrder: 11 },
  { code: '16.2.3', title: 'Patients Excluded from Analysis', documentType: 'LISTING', required: false, sortOrder: 12 },
  { code: '16.2.4', title: 'Demographic Data Listings', documentType: 'LISTING', required: false, sortOrder: 13 },
  { code: '16.2.5', title: 'Efficacy Data Listings', documentType: 'LISTING', required: true, sortOrder: 14 },
  { code: '16.2.6', title: 'Safety Data Listings', documentType: 'LISTING', required: true, sortOrder: 15 },
  { code: '16.2.7', title: 'Adverse Events Listings', documentType: 'LISTING', required: true, sortOrder: 16 },
  { code: '16.3.1', title: 'Publications Based on Study', documentType: 'PDF', required: false, sortOrder: 17 },
  { code: '16.3.2', title: 'Important Publications Referenced', documentType: 'PDF', required: false, sortOrder: 18 },
];
