/**
 * Base CSS styles shared between PDF export and preview
 */
export function getBaseStyles() {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.4;
      color: #1f2937;
      background: white;
      font-size: 11px;
    }

    .cv-container {
      max-width: 100%;
      margin: 0 auto;
      padding: 0;
    }

    /* Header Section */
    .header {
      padding-bottom: 6px;
      margin-bottom: 6px;
    }

    .header h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 6px;
      color: #111827;
    }

    .header .title {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 6px;
    }

    .contact-info {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 11px;
    }

    .contact-item {
      color: #4b5563;
    }

    .contact-links {
      margin-top: 4px;
    }

    .contact-links a {
      color: #2563eb;
      text-decoration: none;
      margin-right: 15px;
    }

    /* Section Styling */
    .section {
      margin-bottom: 10px;
    }

    .section:not(:first-child) {
      margin-top: 15px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }

    /* Summary */
    .summary-content {
      margin-bottom: 15px;
      line-height: 1.6;
      text-align: justify;
    }

    /* Skills */
    .skills-grid {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .skill-category {
      font-size: 11px;
      color: #374151;
      line-height: 1.5;
    }

    .skill-category strong {
      font-weight: 600;
    }

    .skill-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
    }

    /* Experience */
    .experience-item {
      margin-bottom: 15px;
      border-left: 3px solid #e5e7eb;
      padding-left: 15px;
    }

    .experience-item:not(:first-child) {
      margin-top: 8px;
    }

    .experience-header-block,
    .experience-responsibilities-block,
    .experience-deliverables-block {
      /* Ces blocs sont indivisibles dans le PDF */
    }

    .experience-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }

    .experience-title {
      font-weight: 600;
      font-size: 13px;
      color: #111827;
    }

    .experience-company {
      color: #6b7280;
      font-size: 12px;
    }

    .experience-dates {
      font-size: 11px;
      color: #6b7280;
      white-space: nowrap;
      margin-left: 8px;
    }

    .experience-location {
      color: #9ca3af;
    }

    .experience-description {
      margin-bottom: 4px;
      line-height: 1.6;
      text-align: justify;
    }

    .experience-lists {
      display: block;
      margin-bottom: 6px;
    }

    .responsibilities, .deliverables {
      font-size: 11px;
      margin-bottom: 6px;
    }

    .responsibilities h4, .deliverables h4 {
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 4px;
      color: #374151;
    }

    .responsibilities ul, .deliverables ul {
      list-style: disc;
      padding-left: 15px;
      margin-bottom: 8px;
    }

    .responsibilities li, .deliverables li {
      margin-bottom: 2px;
      line-height: 1.3;
    }

    .deliverables-inline {
      margin-top: 6px;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.4;
    }

    .skills-used {
      margin-top: 6px;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.4;
    }

    .skill-tag {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      color: #374151;
    }

    /* Education */
    .education-item {
      margin-bottom: 4px;
      font-size: 11px;
      line-height: 1.5;
      color: #374151;
    }

    .education-item strong {
      font-weight: 600;
      color: #111827;
    }

    .education-dates {
      color: #6b7280;
    }

    /* Projects */
    .project-item {
      margin-bottom: 12px;
    }

    .project-header {
      display: flex;
      justify-content: between;
      align-items: flex-start;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .project-name {
      font-weight: 600;
      color: #111827;
      font-size: 13px;
    }

    .project-role {
      color: #6b7280;
      font-size: 12px;
    }

    .project-dates {
      font-size: 11px;
      color: #6b7280;
      margin-left: auto;
    }

    .project-summary {
      margin-bottom: 10px;
      line-height: 1.6;
      text-align: justify;
    }

    /* Languages */
    .languages-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px 16px;
    }

    .language-item {
      font-size: 11px;
    }

    .language-item:nth-child(3n+1) {
      text-align: left;
    }

    .language-item:nth-child(3n+2) {
      text-align: center;
    }

    .language-item:nth-child(3n) {
      text-align: right;
    }

    /* Extras courts (grille 3 colonnes) */
    .extras-grid-short {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px 16px;
      margin-bottom: 12px;
    }

    .extra-item-short {
      font-size: 11px;
    }

    .extra-item-short:nth-child(3n+1) {
      text-align: left;
    }

    .extra-item-short:nth-child(3n+2) {
      text-align: center;
    }

    .extra-item-short:nth-child(3n) {
      text-align: right;
    }

    /* Extras longs */
    .extra-item {
      margin-bottom: 8px;
      font-size: 11px;
    }
  `;
}

/**
 * Additional styles specific to PDF export (Puppeteer)
 */
export function getExportStyles() {
  return `
    ${getBaseStyles()}

    .break-point {
      break-after: auto;
      page-break-after: auto;
      margin-bottom: 20px;
    }

    .experience-item:not(:first-child) {
      margin-top: 8px;
    }

    .experience-item {
      orphans: 2;
      widows: 2;
    }

    @media print {
      .experience-item {
        margin-top: 8px !important;
        margin-bottom: 8px !important;
      }

      .experience-item:first-child {
        margin-top: 0 !important;
      }
    }

    .experience-header {
      orphans: 3;
      widows: 3;
    }

    /* Bloc 1 : Header + Description (INDIVISIBLE) */
    .experience-header-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Bloc 2 : Responsabilités seules (INDIVISIBLE) */
    .experience-responsibilities-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Bloc 3 : Livrables + Technologies (INDIVISIBLE) */
    .experience-deliverables-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .skill-category {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .responsibilities, .deliverables {
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
    }

    .deliverables-inline {
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
    }

    .skills-used {
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
    }

    .education-item {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .project-item {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .extra-item {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .languages-grid {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Page break utilities */
    .page-break-before {
      page-break-before: always !important;
      break-before: page !important;
    }

    .page-break-after {
      page-break-after: always !important;
      break-after: page !important;
    }

    .page-break-inside-avoid {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .section-title {
        break-after: avoid !important;
        page-break-after: avoid !important;
      }

      /* Blocs indivisibles pour les expériences */
      .experience-header-block,
      .experience-responsibilities-block,
      .experience-deliverables-block {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      /* Autres sections indivisibles */
      .education-item,
      .languages-grid,
      .project-item,
      .extra-item,
      .skill-category {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
  `;
}

/**
 * Additional styles specific to preview
 */
export function getPreviewStyles() {
  return `
    ${getBaseStyles()}

    html {
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }

    body {
      background: #9ca3af;
      padding: 20px;
      display: flex;
      justify-content: center;
      min-height: 100vh;
    }

    .page-wrapper {
      width: 210mm;
      background: white;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      position: relative;
      transform-origin: top center;
      flex-shrink: 0;
      padding-bottom: 15mm;
    }

    .cv-container {
      padding: 15mm;
      position: relative;
    }

    /* Indicateur de saut de page */
    .page-break-indicator {
      position: absolute;
      left: 0;
      right: 0;
      height: 0;
      border-top: 2px dashed #ef4444;
      z-index: 1000;
    }

    .page-break-indicator::before {
      content: 'Saut de page';
      position: absolute;
      right: 0;
      top: -10px;
      background: #ef4444;
      color: white;
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 3px;
    }
  `;
}
