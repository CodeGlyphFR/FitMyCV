#!/usr/bin/env node
/**
 * Script de prévisualisation des templates email
 *
 * Usage:
 *   node scripts/preview-emails.js
 *   node scripts/preview-emails.js --template welcome
 *   node scripts/preview-emails.js --dark
 *   node scripts/preview-emails.js --template password_reset --dark
 *
 * Options:
 *   --template <name>  Prévisualiser un template spécifique (email_verification, welcome, password_reset, email_change, purchase_credits)
 *   --dark             Forcer le mode sombre
 *   --light            Forcer le mode clair (défaut)
 *   --all              Générer tous les templates
 *   --port <number>    Port du serveur (défaut: 3333)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const TEMPLATES_DIR = path.join(__dirname, '../prisma/email-templates');
const OUTPUT_DIR = path.join(__dirname, '../.email-preview');

// Variables de test pour chaque template
const TEST_VARIABLES = {
  email_verification: {
    userName: 'Jean Dupont',
    verificationUrl: 'https://app.fitmycv.io/auth/verify-email?token=abc123xyz',
  },
  welcome: {
    userName: 'Marie Martin',
    loginUrl: 'https://app.fitmycv.io/auth/signin',
    welcomeCredits: '5',
  },
  password_reset: {
    userName: 'Pierre Bernard',
    resetUrl: 'https://app.fitmycv.io/auth/reset-password?token=reset123xyz',
  },
  email_change: {
    userName: 'Sophie Durand',
    verificationUrl: 'https://app.fitmycv.io/auth/verify-email-change?token=change123xyz',
    newEmail: 'sophie.new@example.com',
  },
  purchase_credits: {
    userName: 'Lucas Petit',
    creditsAmount: '50',
    totalPrice: '9,99 €',
    invoiceUrl: 'https://pay.stripe.com/invoice/abc123',
  },
};

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function substituteVariables(html, variables) {
  let result = html;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

function loadTemplates() {
  const templates = {};
  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8');
    const template = JSON.parse(content);
    templates[template.triggerName] = {
      ...template,
      filename: file,
    };
  }

  return templates;
}

function generatePreviewHtml(template, variables, forceDarkMode = null) {
  let html = template.htmlContent;
  html = substituteVariables(html, variables);

  // Si on force un mode, on ajoute un script pour simuler prefers-color-scheme
  if (forceDarkMode !== null) {
    const modeScript = forceDarkMode
      ? `<style>
          /* Force dark mode styles - FitMyCV theme */
          .email-body{background-color:#020617!important}
          .email-container{background-color:#0f172a!important;border-color:#334155!important}
          .email-header{background-color:#1e293b!important}
          .text-primary{color:#f1f5f9!important}
          .text-secondary{color:#cbd5e1!important}
          .text-muted{color:#94a3b8!important}
          .text-accent{color:#60a5fa!important}
          .divider{border-color:#334155!important}
          .link-box{background-color:#1e293b!important;border-color:#60a5fa!important}
          .link-text{color:#60a5fa!important}
          .footer-bg{background-color:#1e293b!important;border-color:#334155!important}
          .feature-card{background-color:#1e293b!important;border-color:#334155!important}
          .feature-title{color:#f1f5f9!important}
          .credits-box{background-color:#422006!important;border-color:#fbbf24!important}
          .credits-label{color:#fde68a!important}
          .credits-value{color:#fbbf24!important}
          .receipt-box{background-color:#1e293b!important;border-color:#3d97f0!important}
          .receipt-row{border-color:#334155!important}
          .receipt-label{color:#cbd5e1!important}
          .total-row{background-color:#1e3a5f!important}
          .total-label{color:#cbd5e1!important}
          .total-value{color:#f1f5f9!important}
          .credits-badge{background-color:#f59e0b!important;color:#ffffff!important}
          .warning-box{background-color:#1e293b!important;border-color:#f59e0b!important}
          .warning-text{color:#fef3c7!important}
          .new-email-box{background-color:#1e293b!important;border-color:#60a5fa!important}
          .new-email-label{color:#94a3b8!important}
          .new-email-value{color:#f1f5f9!important}
          .icon-circle{background-color:#1e293b!important}
          .icon-circle-blue{background-color:#334155!important}
        </style>`
      : '';

    // Insérer avant </head>
    html = html.replace('</head>', `${modeScript}</head>`);
  }

  return html;
}

function generateIndexHtml(templates) {
  const templateLinks = Object.entries(templates)
    .map(([name, template]) => `
      <div style="margin-bottom: 24px; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 8px; color: #1e293b;">${template.name}</h3>
        <p style="margin: 0 0 16px; color: #64748b; font-size: 14px;">Trigger: ${name}</p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <a href="/${name}.html" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
            <span>Mode Auto</span>
          </a>
          <a href="/${name}-light.html" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: #f8fafc; color: #1e293b; text-decoration: none; border-radius: 8px; font-weight: 500; border: 1px solid #e2e8f0;">
            <span>Mode Clair</span>
          </a>
          <a href="/${name}-dark.html" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: #1e293b; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
            <span>Mode Sombre</span>
          </a>
        </div>
      </div>
    `)
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview Emails - FitMyCV.io</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      margin: 0;
      padding: 40px 20px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      min-height: 100vh;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      color: #1e293b;
      margin: 0 0 8px;
      font-size: 32px;
    }
    .subtitle {
      color: #64748b;
      margin: 0 0 40px;
      font-size: 16px;
    }
    .tip {
      background: #fef3c7;
      border: 1px solid #fbbf24;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 32px;
      font-size: 14px;
      color: #92400e;
    }
    .tip strong { color: #78350f; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Preview des Emails</h1>
    <p class="subtitle">FitMyCV.io - Templates avec support Dark/Light mode</p>

    <div class="tip">
      <strong>Astuce :</strong> Le mode "Auto" s'adapte aux préférences de votre système.
      Sur macOS/Windows, changez le thème système pour voir l'effet en temps réel !
    </div>

    ${templateLinks}
  </div>
</body>
</html>`;
}

function startServer(port = 3333) {
  const templates = loadTemplates();

  // Générer les fichiers de preview
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Index
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), generateIndexHtml(templates));

  // Templates
  for (const [name, template] of Object.entries(templates)) {
    const variables = TEST_VARIABLES[name] || {};

    // Version auto (respecte prefers-color-scheme)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${name}.html`),
      generatePreviewHtml(template, variables, null)
    );

    // Version light forcée
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${name}-light.html`),
      generatePreviewHtml(template, variables, false)
    );

    // Version dark forcée
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${name}-dark.html`),
      generatePreviewHtml(template, variables, true)
    );
  }

  // Serveur HTTP simple
  const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(OUTPUT_DIR, filePath);

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    });
  });

  server.listen(port, () => {
    log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
    log('║                                                            ║', 'cyan');
    log('║   🎨  FitMyCV.io - Email Preview Server                    ║', 'cyan');
    log('║                                                            ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════╝', 'cyan');
    log('', 'reset');
    log(`  📧  ${Object.keys(templates).length} templates chargés`, 'green');
    log('', 'reset');
    log(`  🌐  Ouvrez dans votre navigateur :`, 'yellow');
    log(`      http://localhost:${port}`, 'bright');
    log('', 'reset');
    log('  📋  Templates disponibles :', 'blue');
    for (const name of Object.keys(templates)) {
      log(`      • ${name}`, 'reset');
    }
    log('', 'reset');
    log('  💡  Astuce : Changez le thème de votre OS pour voir', 'yellow');
    log('      le mode dark/light en action !', 'yellow');
    log('', 'reset');
    log('  ⌨️   Ctrl+C pour arrêter le serveur', 'reset');
    log('', 'reset');
  });
}

// Parse arguments
const args = process.argv.slice(2);
const port = args.includes('--port')
  ? parseInt(args[args.indexOf('--port') + 1])
  : 3001;

// Lancer le serveur
startServer(port);
