/**
 * Generate dummy PDF documents for each ICH E3 Module 16 standard section.
 *
 * These are placeholder PDFs for testing the upload / validation / packaging
 * pipeline — NOT real clinical content. Output goes to ./dummy-pdfs/.
 *
 * Usage: npx tsx scripts/generate-dummy-pdfs.ts
 */
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { STANDARD_CSR_SECTIONS } from '../src/lib/standard-sections';

const OUT_DIR = join(process.cwd(), 'dummy-pdfs');
const PAGE = { width: 612, height: 792 }; // US Letter
const MARGIN = 72;

// A few lines of harmless filler per section so the PDFs have realistic length.
const FILLER = [
  'This is a placeholder document generated for testing purposes only.',
  'It contains no real clinical, patient, or study data of any kind.',
  'The content below exists solely to give the file a realistic page count',
  'so the upload, metadata extraction, validation, and eCTD packaging',
  'workflows can be exercised end to end against representative inputs.',
];

function slugify(title: string): string {
  return title.replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function buildPdf(code: string, title: string, docType: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${code} ${title}`);
  pdf.setSubject('Dummy CSR document for testing');
  pdf.setProducer('csr-publishing dummy generator');
  pdf.setCreationDate(new Date());

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // --- Title page ---
  const cover = pdf.addPage([PAGE.width, PAGE.height]);
  cover.drawText('CLINICAL STUDY REPORT', {
    x: MARGIN, y: PAGE.height - MARGIN - 40, size: 14, font: bold, color: rgb(0.3, 0.3, 0.3),
  });
  cover.drawText(`Section ${code}`, {
    x: MARGIN, y: PAGE.height - MARGIN - 110, size: 26, font: bold, color: rgb(0.1, 0.1, 0.4),
  });
  // Wrap the title if long.
  const titleWords = title.split(' ');
  let line = '';
  let ty = PAGE.height - MARGIN - 150;
  for (const w of titleWords) {
    const test = line ? `${line} ${w}` : w;
    if (bold.widthOfTextAtSize(test, 20) > PAGE.width - MARGIN * 2) {
      cover.drawText(line, { x: MARGIN, y: ty, size: 20, font: bold });
      ty -= 28;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) cover.drawText(line, { x: MARGIN, y: ty, size: 20, font: bold });

  cover.drawText(`Document type: ${docType}`, {
    x: MARGIN, y: ty - 50, size: 11, font, color: rgb(0.4, 0.4, 0.4),
  });
  cover.drawText('DUMMY / PLACEHOLDER — NOT REAL DATA', {
    x: MARGIN, y: MARGIN, size: 10, font: bold, color: rgb(0.7, 0.2, 0.2),
  });

  // --- Two content pages ---
  for (let p = 1; p <= 2; p++) {
    const page = pdf.addPage([PAGE.width, PAGE.height]);
    page.drawText(`${code}  ${title}`, {
      x: MARGIN, y: PAGE.height - MARGIN, size: 11, font: bold, color: rgb(0.3, 0.3, 0.3),
    });
    let y = PAGE.height - MARGIN - 40;
    for (let i = 0; i < FILLER.length; i++) {
      page.drawText(FILLER[i], { x: MARGIN, y, size: 11, font });
      y -= 22;
    }
    page.drawText(`Page ${p} of 2`, {
      x: PAGE.width - MARGIN - 60, y: MARGIN, size: 9, font, color: rgb(0.5, 0.5, 0.5),
    });
  }

  return pdf.save();
}

async function main() {
  // Start clean so re-runs don't leave stale files.
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  let count = 0;
  for (const s of STANDARD_CSR_SECTIONS) {
    const bytes = await buildPdf(s.code, s.title, s.documentType);
    const fileName = `${s.code}_${slugify(s.title)}.pdf`;
    await writeFile(join(OUT_DIR, fileName), bytes);
    count++;
    console.log(`  ✓ ${fileName}`);
  }
  console.log(`\nGenerated ${count} dummy PDFs in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
