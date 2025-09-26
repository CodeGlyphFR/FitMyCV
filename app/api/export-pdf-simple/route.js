import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { promises as fs } from "fs";
import path from "path";
import { auth } from "@/lib/auth/session";
import { readUserCvFile } from "@/lib/cv/storage";

export async function POST(request) {
  try {
    // Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { filename } = await request.json();

    if (!filename) {
      return NextResponse.json({ error: "Nom de fichier manquant" }, { status: 400 });
    }

    // Charger les données du CV via le système de stockage utilisateur
    let cvData;
    try {
      const cvContent = await readUserCvFile(session.user.id, filename);
      cvData = JSON.parse(cvContent);
    } catch (error) {
      return NextResponse.json({ error: "CV introuvable" }, { status: 404 });
    }

    // Lancer Puppeteer avec options compatibles
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ],
      executablePath: puppeteer.executablePath(),
      timeout: 60000
    });

    const page = await browser.newPage();

    // Générer le HTML du CV
    const htmlContent = generatePrintableHtml(cvData);

    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Générer le PDF avec gestion intelligente des sauts de page
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '12mm',
        bottom: '15mm',
        left: '12mm'
      },
      preferCSSPageSize: true,
      displayHeaderFooter: false
    });

    await browser.close();

    // Retourner le PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CV_${filename.replace('.json', '')}.pdf"`
      }
    });

  } catch (error) {
    console.error("Erreur lors de la génération PDF:", error);
    console.error("Stack trace:", error.stack);

    // Erreurs spécifiques de Puppeteer
    if (error.message.includes('Could not find expected browser')) {
      return NextResponse.json({
        error: "Chromium non trouvé. Installation de Puppeteer incomplète."
      }, { status: 500 });
    }

    if (error.message.includes('Failed to launch')) {
      return NextResponse.json({
        error: "Impossible de lancer le navigateur. Vérifiez les dépendances système."
      }, { status: 500 });
    }

    return NextResponse.json({
      error: `Erreur lors de la génération du PDF: ${error.message}`
    }, { status: 500 });
  }
}

function generatePrintableHtml(cvData) {
  const {
    header = {},
    summary = {},
    skills = {},
    experience = [],
    education = [],
    languages = [],
    projects = [],
    extras = [],
    section_titles = {}
  } = cvData;

  const contact = header.contact || {};

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV - ${header.full_name || 'Sans nom'}</title>
  <style>
    @media print {
      @page {
        margin: 20mm 15mm;
        size: A4;
      }

      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      color: #1f2937;
      background: white;
      font-size: 14px;
    }

    .cv-container {
      max-width: 100%;
      margin: 0 auto;
      padding: 0;
    }

    /* Header Section */
    .header {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 20px;
      margin-bottom: 25px;
      page-break-inside: avoid;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #111827;
    }

    .header .title {
      font-size: 18px;
      color: #6b7280;
      margin-bottom: 15px;
    }

    .contact-info {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      font-size: 14px;
    }

    .contact-item {
      color: #4b5563;
    }

    .contact-links {
      margin-top: 8px;
    }

    .contact-links a {
      color: #2563eb;
      text-decoration: none;
      margin-right: 15px;
    }

    /* Section Styling */
    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #111827;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }

    /* Skills */
    .skills-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .skill-category h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #374151;
    }

    .skill-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .skill-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
    }

    /* Experience */
    .experience-item {
      margin-bottom: 30px;
      page-break-inside: avoid;
      border-left: 3px solid #e5e7eb;
      padding-left: 15px;
    }

    .experience-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .experience-title {
      font-weight: 600;
      font-size: 16px;
      color: #111827;
    }

    .experience-company {
      color: #6b7280;
      font-size: 14px;
    }

    .experience-dates {
      font-size: 14px;
      color: #6b7280;
      white-space: nowrap;
      margin-left: 10px;
    }

    .skills-used {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
    }

    .skill-tag {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      color: #374151;
    }

    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      z-index: 1000;
    }

    @media print {
      .print-button {
        display: none;
      }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">📄 Imprimer en PDF</button>

  <div class="cv-container">
    <!-- Header -->
    <header class="header">
      <h1>${header.full_name || 'Sans nom'}</h1>
      ${header.current_title ? `<div class="title">${header.current_title}</div>` : ''}
      <div class="contact-info">
        ${contact.email ? `<span class="contact-item">📧 ${contact.email}</span>` : ''}
        ${contact.phone ? `<span class="contact-item">📞 ${contact.phone}</span>` : ''}
        ${contact.location ? `<span class="contact-item">📍 ${formatLocation(contact.location)}</span>` : ''}
      </div>
      ${contact.links && contact.links.length > 0 ? `
        <div class="contact-links">
          ${contact.links.map(link => `<a href="${link.url}" target="_blank">${link.label || link.url}</a>`).join('')}
        </div>
      ` : ''}
    </header>

    <!-- Summary -->
    ${summary.description || (summary.domains && summary.domains.length > 0) ? `
      <section class="section">
        <h2 class="section-title">${section_titles.summary || 'Résumé'}</h2>
        ${summary.description ? `<div class="summary-content">${summary.description}</div>` : ''}
        ${summary.domains && summary.domains.length > 0 ? `
          <div class="domains">
            ${summary.domains.map(domain => `<span class="skill-item">${domain}</span>`).join('')}
          </div>
        ` : ''}
      </section>
    ` : ''}

    <!-- Skills -->
    ${Object.values(skills).some(skillArray => Array.isArray(skillArray) && skillArray.length > 0) ? `
      <section class="section">
        <h2 class="section-title">${section_titles.skills || 'Compétences'}</h2>
        <div class="skills-grid">
          ${skills.hard_skills && skills.hard_skills.length > 0 ? `
            <div class="skill-category">
              <h3>Compétences techniques</h3>
              <div class="skill-list">
                ${skills.hard_skills.map(skill => `
                  <span class="skill-item">${skill.name}${skill.proficiency ? ` (${skill.proficiency})` : ''}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${skills.tools && skills.tools.length > 0 ? `
            <div class="skill-category">
              <h3>Outils & Technologies</h3>
              <div class="skill-list">
                ${skills.tools.map(tool => `
                  <span class="skill-item">${tool.name}${tool.proficiency ? ` (${tool.proficiency})` : ''}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${skills.soft_skills && skills.soft_skills.length > 0 ? `
            <div class="skill-category">
              <h3>Compétences relationnelles</h3>
              <div class="skill-list">
                ${skills.soft_skills.map(skill => `<span class="skill-item">${skill}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </section>
    ` : ''}

    <!-- Experience -->
    ${experience && experience.length > 0 ? `
      <section class="section">
        <h2 class="section-title">${section_titles.experience || 'Expérience'}</h2>
        ${experience.map(exp => `
          <div class="experience-item">
            <div class="experience-header">
              <div>
                <div class="experience-title">${exp.title || ''}</div>
                <div class="experience-company">${exp.company || ''}${exp.department_or_client ? ` (${exp.department_or_client})` : ''}</div>
              </div>
              <div class="experience-dates">${formatDate(exp.start_date)} — ${formatDate(exp.end_date)}</div>
            </div>
            ${exp.description ? `<div style="margin: 12px 0; line-height: 1.6;">${exp.description}</div>` : ''}

            ${exp.responsibilities && exp.responsibilities.length > 0 ? `
              <div style="margin: 12px 0;">
                <strong>Responsabilités:</strong>
                <ul style="margin: 8px 0 0 20px;">
                  ${exp.responsibilities.map(resp => `<li style="margin: 4px 0;">${resp}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${exp.deliverables && exp.deliverables.length > 0 ? `
              <div style="margin: 12px 0;">
                <strong>Livrables:</strong>
                <ul style="margin: 8px 0 0 20px;">
                  ${exp.deliverables.map(deliv => `<li style="margin: 4px 0;">${deliv}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${exp.skills_used && exp.skills_used.length > 0 ? `
              <div class="skills-used">
                ${exp.skills_used.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </section>
    ` : ''}

    <!-- Autres sections similaires... -->
  </div>

</body>
</html>`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  if (dateStr.toLowerCase() === "present") return "présent";
  const parts = String(dateStr).split("-");
  const year = parts[0];
  const month = parts[1] || "1";
  const mm = String(Number(month)).padStart(2, "0");
  return `${mm}/${year}`;
}

function formatLocation(location) {
  if (!location) return "";
  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country_code) parts.push(`(${location.country_code})`);
  return parts.join(", ");
}