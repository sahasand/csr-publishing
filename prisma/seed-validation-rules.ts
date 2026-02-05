import { Prisma, PrismaClient, ValidationCategory, ValidationSeverity } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedValidationRule {
  name: string;
  category: ValidationCategory;
  checkFn: string;
  params: Prisma.InputJsonValue;
  severity: ValidationSeverity;
  autoFix: boolean;
  message: string;
}

const defaultValidationRules: SeedValidationRule[] = [
  // ============================================
  // PDF Compliance Rules
  // ============================================
  {
    name: 'pdf-file-size',
    category: 'ECTD_TECHNICAL',
    checkFn: 'checkFileSize',
    params: { maxMB: 100 },
    severity: 'ERROR',
    autoFix: false,
    message: 'File size exceeds maximum limit of 100MB',
  },
  {
    name: 'pdf-parseable',
    category: 'PDF_COMPLIANCE',
    checkFn: 'checkPdfParseable',
    params: {},
    severity: 'ERROR',
    autoFix: false,
    message: 'PDF file is not parseable or is corrupted',
  },
  {
    name: 'pdf-version',
    category: 'PDF_COMPLIANCE',
    checkFn: 'checkPdfVersion',
    params: { allowedVersions: ['1.4', '1.5', '1.6', '1.7'] },
    severity: 'ERROR',
    autoFix: false,
    message: 'PDF version must be between 1.4 and 1.7',
  },
  {
    name: 'pdf-not-encrypted',
    category: 'PDF_COMPLIANCE',
    checkFn: 'checkNotEncrypted',
    params: {},
    severity: 'ERROR',
    autoFix: false,
    message: 'PDF must not be encrypted or password protected',
  },
  {
    name: 'pdf-fonts-embedded',
    category: 'PDF_COMPLIANCE',
    checkFn: 'checkFontsEmbedded',
    params: {},
    severity: 'ERROR',
    autoFix: false,
    message: 'All fonts must be embedded in the PDF',
  },
  {
    name: 'pdfa-compliance',
    category: 'PDF_COMPLIANCE',
    checkFn: 'checkPdfACompliance',
    params: { allowedVersions: ['1a', '1b', '2a', '2b'] },
    severity: 'WARNING',
    autoFix: false,
    message: 'PDF should be PDF/A-1b or PDF/A-2b compliant',
  },

  // ============================================
  // eCTD-Specific Rules
  // ============================================
  {
    name: 'ectd-bookmark-depth',
    category: 'ECTD_TECHNICAL',
    checkFn: 'checkBookmarkDepth',
    params: { maxDepth: 4 },
    severity: 'ERROR',
    autoFix: false,
    message: 'Bookmark hierarchy exceeds eCTD maximum of 4 levels',
  },
  {
    name: 'ectd-bookmarks-exist',
    category: 'ECTD_TECHNICAL',
    checkFn: 'checkBookmarksExist',
    params: { required: true },
    severity: 'WARNING',
    autoFix: false,
    message: 'PDF should have navigation bookmarks for eCTD submissions',
  },
  {
    name: 'ectd-file-naming',
    category: 'ECTD_TECHNICAL',
    checkFn: 'checkFileNaming',
    params: { maxLength: 64, requireLowercase: true },
    severity: 'ERROR',
    autoFix: false,
    message: 'File name does not meet eCTD naming conventions',
  },
  {
    name: 'ectd-page-size',
    category: 'ECTD_TECHNICAL',
    checkFn: 'checkPageSize',
    params: { allowedSizes: ['Letter', 'A4', 'Letter-Landscape', 'A4-Landscape'] },
    severity: 'WARNING',
    autoFix: false,
    message: 'Page size should be standard Letter or A4',
  },
  {
    name: 'ectd-no-external-links',
    category: 'ECTD_TECHNICAL',
    checkFn: 'checkExternalHyperlinks',
    params: { allowExternal: false, allowedDomains: [] },
    severity: 'WARNING',
    autoFix: false,
    message: 'PDF contains external hyperlinks which may not be allowed in eCTD',
  },
  {
    name: 'ectd-no-javascript',
    category: 'PDF_COMPLIANCE',
    checkFn: 'checkNoJavaScript',
    params: {},
    severity: 'ERROR',
    autoFix: false,
    message: 'PDF must not contain JavaScript or executable content',
  },
];

async function seedValidationRules() {
  console.log('Seeding validation rules...');

  for (const rule of defaultValidationRules) {
    // Use upsert to avoid duplicates based on name
    const existingRule = await prisma.validationRule.findFirst({
      where: { name: rule.name },
    });

    if (existingRule) {
      console.log(`  Validation rule "${rule.name}" already exists, updating...`);
      await prisma.validationRule.update({
        where: { id: existingRule.id },
        data: {
          category: rule.category,
          checkFn: rule.checkFn,
          params: rule.params,
          severity: rule.severity,
          autoFix: rule.autoFix,
          message: rule.message,
          isActive: true,
        },
      });
    } else {
      console.log(`  Creating validation rule "${rule.name}"...`);
      await prisma.validationRule.create({
        data: {
          name: rule.name,
          category: rule.category,
          checkFn: rule.checkFn,
          params: rule.params,
          severity: rule.severity,
          autoFix: rule.autoFix,
          message: rule.message,
          isActive: true,
        },
      });
    }
  }

  console.log('Validation rules seeded successfully!');
}

async function main() {
  try {
    await seedValidationRules();
  } catch (error) {
    console.error('Error seeding validation rules:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
