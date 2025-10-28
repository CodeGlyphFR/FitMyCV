# Guide MCP Puppeteer pour Claude Code

## Vue d'ensemble

Le serveur MCP Puppeteer permet à Claude Code d'interagir avec des navigateurs web via Puppeteer. C'est un outil puissant pour :
- **Analyse UX/UI visuelle** : Capturer des screenshots pour analyser le design
- **Tests automatisés** : Vérifier les flux utilisateurs
- **Debugging visuel** : Capturer l'état de l'application lors d'erreurs
- **Audit accessibilité** : Analyser la structure HTML

---

## Installation

### 1. Installer le serveur MCP

```bash
claude mcp add-json "puppeteer" '{"command":"npx","args":["-y","@modelcontextprotocol/server-puppeteer"]}'
```

### 2. Vérifier l'installation

```bash
claude mcp list
```

Vous devriez voir :
```
puppeteer: npx -y @modelcontextprotocol/server-puppeteer - ✓ Connected
```

### 3. Redémarrer Claude Code

**Important** : Fermez complètement Claude Code et relancez-le pour que le serveur MCP soit chargé.

---

## Configuration Linux (Ubuntu)

Sur Linux, le sandbox Chromium peut bloquer le lancement. Utilisez ces options :

```javascript
{
  allowDangerous: true,
  launchOptions: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
}
```

---

## Outils disponibles

Une fois installé, vous avez accès à 7 outils Puppeteer :

| Outil | Description | Exemple |
|-------|-------------|---------|
| `puppeteer_navigate` | Naviguer vers une URL | Ouvrir `http://localhost:3000` |
| `puppeteer_screenshot` | Capturer un screenshot | Screenshot 1920x1080 |
| `puppeteer_click` | Cliquer sur un élément | Cliquer sur un bouton |
| `puppeteer_fill` | Remplir un champ | Saisir email/password |
| `puppeteer_evaluate` | Exécuter du JavaScript | Manipuler le DOM |
| `puppeteer_hover` | Survoler un élément | Tester les hovers |
| `puppeteer_select` | Sélectionner une option | Dropdown menus |

---

## Workflow typique

### 1. Lancer le serveur de développement

```bash
npm run dev  # Port 3001 (dev)
# OU
npm start    # Port 3000 (prod)
```

### 2. Naviguer vers l'application

```javascript
await puppeteer_navigate({
  url: "http://localhost:3001",
  allowDangerous: true,
  launchOptions: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});
```

### 3. Capturer un screenshot

```javascript
await puppeteer_screenshot({
  name: "homepage",
  width: 1920,
  height: 1080
});
```

### 4. Interagir avec la page

```javascript
// Cliquer sur un bouton
await puppeteer_click({
  selector: "button[type='submit']"
});

// Remplir un formulaire
await puppeteer_fill({
  selector: "input[type='email']",
  value: "user@example.com"
});

// Exécuter du JavaScript
await puppeteer_evaluate({
  script: `
    (function() {
      window.scrollTo(0, document.body.scrollHeight);
    })();
  `
});
```

---

## Cas d'usage : Analyse UX

### Objectif
Analyser l'UX de votre application en capturant des screenshots des principales pages.

### Workflow

1. **Lancer le serveur prod**
   ```bash
   npm run build && npm start
   ```

2. **Désactiver le reCAPTCHA (si nécessaire)**

   Si votre application utilise reCAPTCHA, Puppeteer sera bloqué. Solution :

   **A. Ajouter un bypass temporaire**

   Fichier : `app/api/recaptcha/verify/route.js`
   ```javascript
   export async function POST(request) {
     try {
       const { token, action } = await request.json();

       // TEMPORARY: Bypass reCAPTCHA for testing with Puppeteer MCP
       if (process.env.BYPASS_RECAPTCHA === 'true') {
         console.log('[reCAPTCHA] BYPASS MODE ENABLED');
         return NextResponse.json({
           success: true,
           score: 1.0,
         });
       }

       // ... reste du code
     }
   }
   ```

   **B. Activer le bypass dans `.env.local`**
   ```bash
   # TEMPORARY: Bypass reCAPTCHA for Puppeteer MCP testing
   BYPASS_RECAPTCHA=true
   ```

   **C. Rebuild et redémarrer**
   ```bash
   npm run build
   sudo systemctl restart cv-site  # ou npm start
   ```

   ⚠️ **Important** : Ne déployez jamais `BYPASS_RECAPTCHA=true` en production publique !

3. **Se connecter**
   ```javascript
   // Naviguer vers la page de connexion
   await puppeteer_navigate({
     url: "https://your-domain.com/auth"
   });

   // Remplir le formulaire
   await puppeteer_click({ selector: "input[type='email']" });
   await puppeteer_fill({
     selector: "input[type='email']",
     value: "test@example.com"
   });

   await puppeteer_click({ selector: "input[type='password']" });
   await puppeteer_fill({
     selector: "input[type='password']",
     value: "password123"
   });

   // Soumettre
   await puppeteer_click({ selector: "button[type='submit']" });

   // Attendre la redirection
   await sleep(3);
   ```

4. **Capturer les pages principales**
   ```javascript
   // Dashboard
   await puppeteer_screenshot({
     name: "dashboard",
     width: 1920,
     height: 1080
   });

   // Page abonnements
   await puppeteer_navigate({
     url: "https://your-domain.com/account/subscriptions"
   });
   await sleep(2);
   await puppeteer_screenshot({
     name: "subscriptions",
     width: 1920,
     height: 1080
   });
   ```

5. **Analyser visuellement**
   Claude Code affichera les screenshots et pourra :
   - Analyser l'UX/UI
   - Détecter les problèmes d'accessibilité
   - Proposer des améliorations
   - Vérifier le responsive design

---

## Pièges à éviter

### 1. Sélecteurs invalides

❌ **Mauvais** : Utiliser des sélecteurs non-standards
```javascript
await puppeteer_click({ selector: "button:has-text('Login')" });
```

✅ **Bon** : Utiliser des sélecteurs CSS standards
```javascript
await puppeteer_click({ selector: "button[type='submit']" });
```

Si besoin de texte, utilisez `evaluate` :
```javascript
await puppeteer_evaluate({
  script: `
    (function() {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.includes('Login'));
      if (btn) btn.click();
    })();
  `
});
```

### 2. Valeurs de formulaire non persistées

Les événements JavaScript standards (`input.value = "..."`) peuvent ne pas être détectés par React.

✅ **Solution** : Utiliser `puppeteer_fill` qui simule une vraie saisie clavier
```javascript
await puppeteer_click({ selector: "input[type='email']" });
await puppeteer_fill({
  selector: "input[type='email']",
  value: "user@example.com"
});
```

### 3. Redirection trop rapide

Attendez toujours après une action asynchrone :
```javascript
await puppeteer_click({ selector: "button[type='submit']" });
await sleep(3);  // Attendre la redirection
await puppeteer_screenshot({ name: "after-login" });
```

### 4. URL localhost vs domaine public

Si la connexion échoue sur `localhost:3000`, essayez l'URL publique :
```javascript
// Au lieu de
await puppeteer_navigate({ url: "http://localhost:3000" });

// Utilisez
await puppeteer_navigate({ url: "https://your-domain.com" });
```

### 5. reCAPTCHA et protections anti-bot

Puppeteer sera systématiquement bloqué par :
- reCAPTCHA v2/v3
- Cloudflare Turnstile
- hCaptcha

**Solution** : Désactiver temporairement en dev/test (voir section "Cas d'usage : Analyse UX")

---

## Bonnes pratiques

### 1. Toujours attendre le chargement

```javascript
await puppeteer_navigate({ url: "https://..." });
await sleep(2);  // Attendre le chargement
await puppeteer_screenshot({ name: "page" });
```

### 2. Fermer les modals/bandeaux

```javascript
// Fermer le bandeau cookies
await puppeteer_evaluate({
  script: `
    (function() {
      const acceptBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.includes('Accepter'));
      if (acceptBtn) acceptBtn.click();
    })();
  `
});
```

### 3. Scroller pour voir le contenu

```javascript
// Scroller vers le bas
await puppeteer_evaluate({
  script: `window.scrollTo(0, document.body.scrollHeight);`
});

await sleep(1);
await puppeteer_screenshot({ name: "page-bottom" });
```

### 4. Vérifier l'URL actuelle

```javascript
await puppeteer_evaluate({
  script: `console.log('Current URL:', window.location.href);`
});
```

### 5. Utiliser des screenshots descriptifs

```javascript
// ❌ Mauvais
await puppeteer_screenshot({ name: "test1" });

// ✅ Bon
await puppeteer_screenshot({ name: "dashboard-empty-state" });
await puppeteer_screenshot({ name: "subscriptions-plans-comparison" });
```

---

## Debugging

### Vérifier si les outils sont disponibles

Après redémarrage de Claude Code, vérifiez que les outils Puppeteer sont chargés :
```bash
claude mcp list
```

Si le serveur est en erreur, vérifiez :
1. Node.js est installé (v16+)
2. Claude Code a été redémarré
3. Pas de conflit avec un autre processus Chromium

### Logs du serveur MCP

Les logs du serveur MCP s'affichent dans la console de Claude Code.

---

## Exemples concrets

### Exemple 1 : Capture complète d'un site

```javascript
// 1. Naviguer vers la page d'accueil
await puppeteer_navigate({
  url: "https://your-site.com",
  allowDangerous: true,
  launchOptions: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

// 2. Accepter les cookies
await puppeteer_evaluate({
  script: `
    (function() {
      const btn = document.querySelector('[data-cookie-accept]');
      if (btn) btn.click();
    })();
  `
});

await sleep(1);

// 3. Screenshot desktop
await puppeteer_screenshot({
  name: "homepage-desktop",
  width: 1920,
  height: 1080
});

// 4. Screenshot mobile
await puppeteer_screenshot({
  name: "homepage-mobile",
  width: 375,
  height: 812
});

// 5. Scroller et capturer le bas de page
await puppeteer_evaluate({
  script: `window.scrollTo(0, document.body.scrollHeight);`
});

await sleep(1);

await puppeteer_screenshot({
  name: "homepage-footer",
  width: 1920,
  height: 1080
});
```

### Exemple 2 : Test d'un flux complet

```javascript
// 1. Page de connexion
await puppeteer_navigate({ url: "https://your-site.com/auth" });
await puppeteer_screenshot({ name: "01-login-page" });

// 2. Remplir le formulaire
await puppeteer_click({ selector: "input[type='email']" });
await puppeteer_fill({ selector: "input[type='email']", value: "test@example.com" });

await puppeteer_click({ selector: "input[type='password']" });
await puppeteer_fill({ selector: "input[type='password']", value: "password" });

await puppeteer_screenshot({ name: "02-login-filled" });

// 3. Soumettre
await puppeteer_click({ selector: "button[type='submit']" });
await sleep(3);

await puppeteer_screenshot({ name: "03-dashboard" });

// 4. Naviguer vers les paramètres
await puppeteer_click({ selector: "a[href='/settings']" });
await sleep(2);

await puppeteer_screenshot({ name: "04-settings" });
```

---

## Limitations

### Ce que Puppeteer MCP NE PEUT PAS faire

1. **Contourner les protections anti-bot** (reCAPTCHA, Cloudflare)
2. **Gérer les téléchargements de fichiers** (PDFs, etc.)
3. **Interagir avec les extensions navigateur**
4. **Accéder aux APIs privées** sans authentification
5. **Exécuter du code côté serveur** (uniquement client)

### Alternatives

Pour tester des flux complexes, préférez :
- Playwright (via un autre MCP)
- Tests E2E traditionnels (Cypress, etc.)
- Tests manuels avec screenshots partagés

---

## Checklist avant une session d'analyse UX

- [ ] Serveur dev/prod lancé (`npm run dev` ou `npm start`)
- [ ] Claude Code redémarré après installation MCP
- [ ] `claude mcp list` affiche Puppeteer en ✓ Connected
- [ ] reCAPTCHA désactivé si nécessaire (`BYPASS_RECAPTCHA=true`)
- [ ] Identifiants de test disponibles
- [ ] URLs à tester notées (dashboard, settings, etc.)

---

## Ressources

- [Documentation officielle MCP](https://modelcontextprotocol.io/)
- [Puppeteer API](https://pptr.dev/)
- [Sélecteurs CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors)

---

## Support

En cas de problème :
1. Vérifier les logs de Claude Code
2. Relancer `claude mcp list`
3. Redémarrer Claude Code
4. Consulter `docs/CLAUDE.md` section MCP Puppeteer

---

**Dernière mise à jour** : 2025-10-26
