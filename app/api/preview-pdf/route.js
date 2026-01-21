import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { readUserCvFileWithMeta } from "@/lib/cv-core/storage";
import { CommonErrors, CvErrors } from "@/lib/api/apiErrors";
import {
  getTranslation,
  prepareCvData,
  DEFAULT_SECTION_ORDER,
  getPreviewStyles,
  generateHeaderSection,
  createSectionGenerators,
  generateSectionsHtml
} from "@/lib/pdf";

/**
 * API route to preview CV as HTML with page break indicators
 * Does not consume credits
 */
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const requestData = await request.json();
    let filename = requestData.filename;
    const language = requestData.language || 'fr';
    const selections = requestData.selections || null;
    const sectionsOrder = requestData.sectionsOrder || DEFAULT_SECTION_ORDER;

    if (typeof filename === 'object' && filename !== null) {
      filename = filename.file || filename.name || filename.filename || String(filename);
    }
    filename = String(filename || '');

    if (!filename || filename === 'undefined') {
      return CvErrors.missingFilename();
    }

    // Load CV data
    let cvData;
    let cvLanguage;
    try {
      const cvResult = await readUserCvFileWithMeta(session.user.id, filename);
      cvData = cvResult.content;
      cvLanguage = cvResult.language || language || cvData?.language || 'fr';
    } catch (error) {
      console.error('[PDF Preview] Error loading CV:', error);
      return CvErrors.notFound();
    }

    // Generate HTML preview
    const htmlContent = generatePreviewHtml(cvData, cvLanguage, selections, sectionsOrder);

    return NextResponse.json({ html: htmlContent });

  } catch (error) {
    console.error("Erreur lors de la prévisualisation:", error);
    return NextResponse.json({ error: "Erreur lors de la prévisualisation" }, { status: 500 });
  }
}

function generatePreviewHtml(cvData, language = 'fr', selections = null, sectionsOrder = null) {
  const t = (path) => getTranslation(language, path);
  const order = sectionsOrder || DEFAULT_SECTION_ORDER;

  // Prepare CV data
  const data = prepareCvData(cvData, selections);

  // Create section generators (preview mode)
  const sectionGenerators = createSectionGenerators(data, language, selections, {
    isExport: false
  });

  // Generate header
  const headerHtml = generateHeaderSection(data.header, data.contact, selections, language);

  // Generate sections
  const sectionsHtml = generateSectionsHtml(sectionGenerators, order);

  return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>CV Preview - ${data.header.full_name || t('cvSections.header')}</title>
  <style>
    ${getPreviewStyles()}
  </style>
</head>
<body>
  <div class="page-wrapper">
    <div class="cv-container" id="cv-container">
      ${headerHtml}
      ${sectionsHtml}
    </div>
  </div>

  <script>
    ${getPageBreakScript()}
  </script>
</body>
</html>
  `;
}

/**
 * Client-side script for simulating page breaks in preview
 */
function getPageBreakScript() {
  return `
    // Simulate page breaks exactly as Puppeteer/CSS does
    window.addEventListener('load', function() {
      const container = document.getElementById('cv-container');
      const pageWrapper = document.querySelector('.page-wrapper');

      // Content height per page calibrated for Puppeteer
      // A4 = 297mm, margins = 15mm top + 15mm bottom = 30mm, content = 267mm
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const isMobile = window.innerWidth < 500 && !isIOS;
      // A4 = 297mm, margins = 30mm (15+15), content zone = 267mm ≈ 1008px at 96 DPI
      const PAGE_HEIGHT = isMobile ? 1680 : 1008;

      // Content start position (after container padding)
      const containerStyle = getComputedStyle(container);
      const paddingTop = parseFloat(containerStyle.paddingTop);
      const containerRect = container.getBoundingClientRect();
      const containerTop = containerRect.top + window.scrollY + paddingTop;

      // Elements with break-inside: avoid
      const breakInsideAvoidSelectors = [
        '.experience-header-block',
        '.experience-responsibilities-block',
        '.experience-deliverables-block',
        '.skill-category',
        '.education-item',
        '.project-item',
        '.extra-item',
        '.languages-grid'
      ];

      // Elements with break-after: avoid
      const breakAfterAvoidSelectors = [
        '.section-title'
      ];

      // Build list of indivisible blocks
      const blocks = [];

      breakInsideAvoidSelectors.forEach(selector => {
        container.querySelectorAll(selector).forEach(el => {
          const rect = el.getBoundingClientRect();
          blocks.push({
            element: el,
            top: rect.top + window.scrollY - containerTop,
            bottom: rect.bottom + window.scrollY - containerTop,
            height: rect.height,
            type: 'break-inside-avoid'
          });
        });
      });

      // For section-title with break-after: avoid, group with next element
      breakAfterAvoidSelectors.forEach(selector => {
        container.querySelectorAll(selector).forEach(el => {
          const rect = el.getBoundingClientRect();
          const titleTop = rect.top + window.scrollY - containerTop;

          const section = el.closest('.section');
          if (section) {
            const firstChild = section.querySelector('.experience-item, .skill-category, .education-item, .project-item, .extra-item, .extras-grid-short, .languages-grid, .summary-content');
            if (firstChild) {
              const childRect = firstChild.getBoundingClientRect();
              blocks.push({
                element: el,
                top: titleTop,
                bottom: childRect.bottom + window.scrollY - containerTop,
                height: (childRect.bottom + window.scrollY - containerTop) - titleTop,
                type: 'title-with-content'
              });
            }
          }
        });
      });

      blocks.sort((a, b) => a.top - b.top);

      // Remove duplicates
      const uniqueBlocks = [];
      for (const block of blocks) {
        const isDuplicate = uniqueBlocks.some(existing =>
          block.top >= existing.top && block.bottom <= existing.bottom
        );
        if (!isDuplicate) {
          uniqueBlocks.push(block);
        }
      }

      // Simulate pagination
      const pageBreaks = [];
      let currentPageEnd = PAGE_HEIGHT;
      const paddingBottom = parseFloat(containerStyle.paddingBottom);
      const totalHeight = container.scrollHeight - paddingTop - paddingBottom;
      const TOLERANCE = 5;

      // Responsive scaling
      function applyResponsiveScale() {
        const pageWrapper = document.querySelector('.page-wrapper');
        if (!pageWrapper) return;

        pageWrapper.style.transform = 'none';
        pageWrapper.style.marginBottom = '';

        const pageWidthPx = pageWrapper.offsetWidth;
        const originalHeight = pageWrapper.offsetHeight;
        const minMargin = 20;
        const availableWidth = window.innerWidth - (minMargin * 2);

        if (availableWidth < pageWidthPx * 0.98) {
          const scale = availableWidth / pageWidthPx;
          pageWrapper.style.transform = 'scale(' + scale + ')';
          const visualHeight = originalHeight * scale;
          const spaceSaved = originalHeight - visualHeight;
          pageWrapper.style.marginBottom = '-' + spaceSaved + 'px';
        }
      }

      // If content fits on single page, no page breaks
      if (totalHeight <= PAGE_HEIGHT + TOLERANCE) {
        applyResponsiveScale();
        window.addEventListener('resize', applyResponsiveScale);
        return;
      }

      const MIN_CUT_THRESHOLD = 5;

      while (currentPageEnd < totalHeight + PAGE_HEIGHT) {
        let blockToCut = null;

        for (const block of uniqueBlocks) {
          if (block.top < currentPageEnd && block.bottom > currentPageEnd) {
            const cutAmount = block.bottom - currentPageEnd;
            if (cutAmount > MIN_CUT_THRESHOLD) {
              if (!blockToCut || block.top < blockToCut.top) {
                blockToCut = block;
              }
            }
          }
        }

        if (blockToCut) {
          let breakPosition = blockToCut.top;

          for (const block of uniqueBlocks) {
            if (block.type === 'title-with-content' &&
                block.bottom < blockToCut.top &&
                block.bottom > blockToCut.top - 30) {
              breakPosition = block.top;
              break;
            }
          }

          pageBreaks.push(breakPosition);
          currentPageEnd = breakPosition + PAGE_HEIGHT;
        } else {
          let titleToMove = null;
          const TITLE_MARGIN = 100;

          for (const block of uniqueBlocks) {
            if (block.type === 'title-with-content' &&
                block.bottom > currentPageEnd - TITLE_MARGIN &&
                block.bottom <= currentPageEnd) {
              const contentCut = uniqueBlocks.some(b =>
                b.top > block.bottom && b.top < currentPageEnd && b.bottom > currentPageEnd
              );
              if (contentCut) {
                titleToMove = block;
                break;
              }
            }
          }

          if (titleToMove) {
            pageBreaks.push(titleToMove.top);
            currentPageEnd = titleToMove.top + PAGE_HEIGHT;
          } else {
            if (currentPageEnd < totalHeight) {
              pageBreaks.push(currentPageEnd);
            }
            currentPageEnd = currentPageEnd + PAGE_HEIGHT;
          }
        }
      }

      // Identify page break elements
      const pageBreakElements = [];
      const breakableElements = [
        ...Array.from(container.querySelectorAll('.section')),
        ...Array.from(container.querySelectorAll('.experience-item')),
        ...Array.from(container.querySelectorAll('.experience-header-block')),
        ...Array.from(container.querySelectorAll('.experience-responsibilities-block')),
        ...Array.from(container.querySelectorAll('.experience-deliverables-block')),
        ...Array.from(container.querySelectorAll('.education-item')),
        ...Array.from(container.querySelectorAll('.project-item')),
        ...Array.from(container.querySelectorAll('.extra-item'))
      ].map(el => {
        const rect = el.getBoundingClientRect();
        return {
          element: el,
          top: rect.top + window.scrollY - containerTop
        };
      }).sort((a, b) => a.top - b.top);

      const MIN_OVERFLOW_THRESHOLD = 50;

      pageBreaks.forEach(breakPosition => {
        let closestElement = null;
        let closestDistance = Infinity;

        for (const item of breakableElements) {
          if (item.top >= breakPosition + MIN_OVERFLOW_THRESHOLD) {
            const distance = item.top - breakPosition;
            if (distance < closestDistance) {
              closestDistance = distance;
              closestElement = item.element;
            }
          }
        }

        if (closestElement) {
          let identifier = null;

          if (closestElement.classList.contains('section')) {
            const sectionTitle = closestElement.querySelector('.section-title');
            if (sectionTitle) {
              identifier = { type: 'section', title: sectionTitle.textContent.trim() };
            }
          } else if (closestElement.classList.contains('experience-item')) {
            const index = Array.from(container.querySelectorAll('.experience-item')).indexOf(closestElement);
            identifier = { type: 'experience-item', index: index };
          } else if (closestElement.classList.contains('experience-header-block')) {
            const expItem = closestElement.closest('.experience-item');
            if (expItem) {
              const index = Array.from(container.querySelectorAll('.experience-item')).indexOf(expItem);
              identifier = { type: 'experience-header-block', index: index };
            }
          } else if (closestElement.classList.contains('experience-responsibilities-block')) {
            const expItem = closestElement.closest('.experience-item');
            if (expItem) {
              const index = Array.from(container.querySelectorAll('.experience-item')).indexOf(expItem);
              identifier = { type: 'experience-responsibilities-block', index: index };
            }
          } else if (closestElement.classList.contains('experience-deliverables-block')) {
            const expItem = closestElement.closest('.experience-item');
            if (expItem) {
              const index = Array.from(container.querySelectorAll('.experience-item')).indexOf(expItem);
              identifier = { type: 'experience-deliverables-block', index: index };
            }
          } else if (closestElement.classList.contains('education-item')) {
            const index = Array.from(container.querySelectorAll('.education-item')).indexOf(closestElement);
            identifier = { type: 'education-item', index: index };
          } else if (closestElement.classList.contains('project-item')) {
            const index = Array.from(container.querySelectorAll('.project-item')).indexOf(closestElement);
            identifier = { type: 'project-item', index: index };
          } else if (closestElement.classList.contains('extra-item')) {
            const index = Array.from(container.querySelectorAll('.extra-item')).indexOf(closestElement);
            identifier = { type: 'extra-item', index: index };
          }

          if (identifier) {
            pageBreakElements.push(identifier);
          }
        }
      });

      // Send page break elements to parent
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'pageBreakElements',
          elements: pageBreakElements
        }, '*');
      }

      // Add visual indicators
      pageBreaks.forEach(position => {
        const indicator = document.createElement('div');
        indicator.className = 'page-break-indicator';
        indicator.style.top = (position + paddingTop) + 'px';
        container.appendChild(indicator);
      });

      // Apply scale after calculating page breaks
      applyResponsiveScale();
      window.addEventListener('resize', applyResponsiveScale);
    });
  `;
}
