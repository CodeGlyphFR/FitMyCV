# Optimisation des performances

## Problème observé

Le site semble moins réactif après la migration, avec des actions lentes à charger.

## Causes possibles

### 1. **Compilation Next.js plus lourde**
- 1000+ modules à compiler (visible dans les logs)
- Nouveaux packages ajoutés : `openai`, `pdf2json`, `luxon`
- Cache `.next` potentiellement corrompu après modifications

### 2. **Import de modules lourds**
- `openai` SDK est volumineux (~50MB de node_modules)
- `pdf2json` charge des dépendances natives

### 3. **Hot Module Replacement (HMR)**
- Chaque modification déclenche une recompilation
- En dev, Next.js recompile à chaque requête si le code a changé

---

## Solutions immédiates

### 1. Nettoyer le cache Next.js

```bash
rm -rf .next
npm run dev
```

**Quand le faire** : Après avoir ajouté/supprimé des packages ou si des erreurs étranges apparaissent.

### 2. Nettoyer node_modules (si nécessaire)

```bash
rm -rf node_modules package-lock.json
npm install
```

**Quand le faire** : Si le nettoyage du cache ne suffit pas.

### 3. Vérifier qu'aucun processus zombie ne tourne

```bash
# Voir les processus Node
ps aux | grep node

# Tuer les processus sur le port 3001
lsof -ti:3001 | xargs kill -9
```

---

## Optimisations code

### 1. Import dynamique des modules lourds (Déjà fait ✅)

Les modules OpenAI sont importés uniquement dans les workers, pas au chargement de l'app.

### 2. Lazy loading des composants lourds

Si certains composants sont lourds, utiliser `next/dynamic` :

```javascript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
  loading: () => <p>Chargement...</p>,
  ssr: false // Désactive le rendu serveur si pas nécessaire
});
```

### 3. Désactiver le source map en dev (si vraiment nécessaire)

**⚠️ Déconseillé** car rend le debug plus difficile, mais accélère la compilation :

`next.config.js` :
```javascript
module.exports = {
  productionBrowserSourceMaps: false,
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = 'eval'; // Plus rapide que 'source-map'
    }
    return config;
  },
};
```

---

## Comparaison Dev vs Production

### En développement (npm run dev)
- ❌ Compilation à la demande (plus lent)
- ❌ Hot Module Replacement (overhead)
- ❌ Source maps complets
- ✅ Logs détaillés
- ✅ Fast Refresh

### En production (npm run build + npm start)
- ✅ Pre-compilé et optimisé
- ✅ Bundles minifiés
- ✅ Tree-shaking des imports inutilisés
- ✅ Code splitting automatique
- ✅ ~10x plus rapide

**Recommandation** : Tester en production pour voir les vraies performances.

---

## Build de production optimisé

```bash
# Build optimisé
npm run build

# Démarrer en mode production
npm start
```

### Vérifications après build

1. Taille des bundles :
```
Route (app)                              Size     First Load JS
┌ ƒ /                                    16.8 kB         114 kB
├ ƒ /api/background-tasks/import-pdf     0 B             0 B
```

2. Temps de compilation :
```
✓ Compiled successfully in X seconds
```

Si le build prend > 2 minutes, il y a un problème.

---

## Monitoring des performances

### 1. React DevTools Profiler
- Installer l'extension React DevTools
- Onglet "Profiler" pour voir les re-renders lents

### 2. Network tab (Chrome DevTools)
- Voir quels fichiers sont lents à charger
- Désactiver le cache pour voir les vraies perf : Cocher "Disable cache"

### 3. Lighthouse (Chrome DevTools)
- Onglet "Lighthouse"
- Analyser les performances, accessibilité, SEO

---

## Problèmes spécifiques à surveiller

### 1. Trop de requêtes API
Si l'app fait beaucoup de `fetch()` :
- Utiliser du debouncing/throttling
- Mettre en cache les résultats avec SWR ou React Query

### 2. Re-renders inutiles
- Utiliser `React.memo()` pour les composants lourds
- Utiliser `useMemo()` et `useCallback()` si nécessaire

### 3. Trop de logs console
En dev, trop de `console.log()` peut ralentir :
```javascript
// Créer un helper
const devLog = (...args) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};
```

---

## Checklist de diagnostic

Quand le site est lent :

- [ ] Vider le cache Next.js (`rm -rf .next`)
- [ ] Redémarrer le serveur de dev
- [ ] Vérifier la console serveur pour des erreurs/warnings
- [ ] Vérifier la console navigateur pour des erreurs
- [ ] Désactiver les extensions du navigateur
- [ ] Tester dans un autre navigateur
- [ ] Tester en navigation privée
- [ ] Tester en mode production (`npm run build && npm start`)
- [ ] Vérifier l'utilisation CPU/RAM du processus Node

---

## Actions recommandées maintenant

1. **Redémarrer le serveur proprement** :
```bash
# Arrêter
Ctrl+C (ou pkill -f "next dev")

# Nettoyer
rm -rf .next

# Redémarrer
npm run dev
```

2. **Tester quelques actions** :
   - Naviguer entre les pages
   - Ouvrir la modal de tâches
   - Importer un CV

3. **Si toujours lent**, essayer en production :
```bash
npm run build
npm start
```

4. **Comparer avec une branche git précédente** :
```bash
git stash
git checkout <commit-avant-migration>
npm install
npm run dev
# Tester les performances
# Puis revenir :
git checkout -
git stash pop
npm install
```

---

## Conclusion

Les lenteurs en mode dev après ajout de packages sont **normales** et **temporaires**. La vraie performance se mesure en production.

Si les lenteurs persistent en production, il faudra investiguer plus en profondeur (profiling, analyse des bundles, etc.).
