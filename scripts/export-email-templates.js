const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const OUTPUT_DIR = path.join(__dirname, '../prisma/email-templates');

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all templates with their triggers
  const templates = await prisma.emailTemplate.findMany({
    include: {
      trigger: true,
    },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${templates.length} templates to export\n`);

  for (const template of templates) {
    const triggerName = template.trigger?.name || 'no-trigger';
    const templateSlug = slugify(template.name);
    const filename = `${triggerName}--${templateSlug}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);

    const exportData = {
      name: template.name,
      triggerName: template.trigger?.name || null,
      subject: template.subject,
      variables: template.variables,
      htmlContent: template.htmlContent,
      designJson: template.designJson,
      isActive: template.isActive,
      isDefault: template.isDefault,
    };

    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2), 'utf8');
    console.log(`✓ ${filename}`);
  }

  console.log(`\n✨ Exported ${templates.length} templates to prisma/email-templates/`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Error:', e);
    prisma.$disconnect();
    process.exit(1);
  });
