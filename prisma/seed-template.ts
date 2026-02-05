import { db } from '../src/lib/db';
import { STANDARD_CSR_SECTIONS } from '../src/lib/standard-sections';

async function main() {
  console.log('Setting up default CSR template...');

  // Find or create default template
  let template = await db.structureTemplate.findFirst({
    where: { name: 'fda standard' }
  });

  if (!template) {
    template = await db.structureTemplate.create({
      data: { name: 'CSR Standard Template', isDefault: true }
    });
    console.log('Created new template:', template.id);
  } else {
    // Make it default and rename
    await db.structureTemplate.updateMany({ data: { isDefault: false } });
    template = await db.structureTemplate.update({
      where: { id: template.id },
      data: { isDefault: true, name: 'CSR Standard Template' }
    });
    console.log('Using existing template:', template.id);
  }

  // Delete existing nodes
  await db.structureNode.deleteMany({ where: { templateId: template.id } });

  // Add standard CSR sections (ICH E3 Module 16)
  for (const section of STANDARD_CSR_SECTIONS) {
    await db.structureNode.create({
      data: {
        templateId: template.id,
        ...section
      }
    });
  }

  console.log('Added', STANDARD_CSR_SECTIONS.length, 'sections to template');

  // Assign template to any studies without one
  const updated = await db.study.updateMany({
    where: { activeTemplateId: null },
    data: { activeTemplateId: template.id }
  });
  console.log('Assigned template to', updated.count, 'studies');

  console.log('\nDone! Refresh your browser to see the sections.');
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
