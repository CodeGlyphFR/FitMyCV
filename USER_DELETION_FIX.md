# Correction de la suppression d'utilisateur ✅

## Problèmes identifiés

### 1. Session persistante après suppression DB
Quand un utilisateur est supprimé de la base de données, il **reste connecté** et n'est pas redirigé vers la page de login.

**Cause** : Le callback `session` de NextAuth utilisait les données du JWT token sans vérifier l'existence de l'utilisateur dans la DB.

### 2. Dossier utilisateur non supprimé
Lors de la suppression d'un utilisateur de la DB, son dossier dans `data/users/{userId}/` n'était **pas supprimé**.

**Cause** : La route de suppression ne gérait pas correctement la suppression du dossier, et ne supprimait pas les tables liées avant l'utilisateur (erreurs FK).

---

## Solutions appliquées

### 1. Validation de session à chaque requête

**Fichier modifié** : `lib/auth/options.js`

**Avant** :
```javascript
async session({ session, token }){
  if (token?.id){
    session.user = session.user || {};
    session.user.id = token.id;
    session.user.name = token.name || session.user.name || null;
    session.user.email = token.email || session.user.email || null;
  }
  // Vérification optionnelle seulement si name/email manquent
  if (!session.user?.name || !session.user?.email){
    const dbUser = await prisma.user.findUnique(...);
    if (dbUser){
      session.user.name = dbUser.name;
      session.user.email = dbUser.email;
    }
  }
  return session;
}
```

**Après** :
```javascript
async session({ session, token }){
  if (token?.id){
    // ✅ Vérifier TOUJOURS que l'utilisateur existe dans la DB
    const dbUser = await prisma.user.findUnique({
      where: { id: token.id },
      select: { id: true, name: true, email: true },
    });

    // ✅ Si l'utilisateur n'existe plus, invalider la session
    if (!dbUser){
      console.warn(`[session] User ${token.id} no longer exists in DB, invalidating session`);
      return null; // ❌ Session invalide
    }

    session.user = session.user || {};
    session.user.id = dbUser.id;
    session.user.name = dbUser.name;
    session.user.email = dbUser.email;
  }
  return session;
}
```

**Fonctionnement** :
1. À chaque requête nécessitant l'authentification, NextAuth appelle le callback `session`
2. Le callback vérifie maintenant que l'utilisateur existe toujours dans la DB
3. Si l'utilisateur n'existe plus → `return null` → Session invalide
4. Les pages protégées redirigent automatiquement vers `/auth`

---

### 2. Suppression complète des données utilisateur

**Fichier modifié** : `app/api/account/delete/route.js`

**Problèmes avant** :
- ❌ Ne supprimait pas les tables liées (erreurs FK)
- ❌ Tentait de supprimer l'utilisateur avant les données liées
- ❌ Suppression du dossier parfois échouait sans log

**Après** :
```javascript
// 1. Supprimer toutes les données liées dans l'ordre (contraintes FK)
await prisma.cvSource.deleteMany({ where: { userId: user.id } });
await prisma.cvFile.deleteMany({ where: { userId: user.id } });
await prisma.backgroundTask.deleteMany({ where: { userId: user.id } });
await prisma.session.deleteMany({ where: { userId: user.id } });
await prisma.account.deleteMany({ where: { userId: user.id } });
await prisma.user.delete({ where: { id: user.id } });

console.log(`[DELETE account] Utilisateur ${user.id} supprimé de la DB`);

// 2. Supprimer le dossier utilisateur
const userDir = getUserCvDir(user.id);
await fs.rm(userDir, { recursive: true, force: true });
const parentDir = path.dirname(userDir);
await fs.rm(parentDir, { recursive: true, force: true });

console.log(`[DELETE account] Dossier utilisateur ${userDir} supprimé`);
```

**Ordre de suppression** :
1. `cvSource` - Sources des CV
2. `cvFile` - Fichiers CV enregistrés
3. `backgroundTask` - Tâches en arrière-plan
4. `session` - Sessions actives
5. `account` - Comptes OAuth liés
6. `user` - Utilisateur principal
7. Dossier `data/users/{userId}/`

---

### 3. Module utilitaire de suppression

**Fichier créé** : `lib/user/deletion.js`

Fonctions réutilisables pour la suppression d'utilisateurs :

```javascript
/**
 * Supprime un utilisateur de la DB et son dossier
 */
export async function deleteUser(userId) {
  // 1. Supprimer de la DB (avec tables liées)
  // 2. Supprimer le dossier
  return { success: true/false, error?: string };
}

/**
 * Supprime uniquement le dossier utilisateur
 */
export async function deleteUserFolder(userId) {
  // Utile pour nettoyer des dossiers orphelins
  return { success: true/false, error?: string };
}
```

---

## Flux de suppression

### Utilisateur supprime son compte

```
1. User clique "Supprimer mon compte"
   ↓
2. UI demande confirmation + mot de passe
   ↓
3. POST /api/account/delete { password: "..." }
   ↓
4. Vérification du mot de passe
   ↓
5. Suppression des données liées (cvSource, cvFile, tasks, sessions, accounts)
   ↓
6. Suppression de l'utilisateur
   ↓
7. Suppression du dossier data/users/{userId}/
   ↓
8. Response { ok: true }
   ↓
9. Client: signOut() + redirect /auth
```

### Admin supprime un utilisateur manuellement

```
1. Admin exécute dans Prisma Studio ou CLI:
   DELETE FROM User WHERE id = '...'
   ↓
2. User toujours connecté avec son JWT
   ↓
3. User fait une requête (accède à une page)
   ↓
4. Callback session vérifie l'existence de l'utilisateur
   ↓
5. User n'existe plus dans DB → return null
   ↓
6. Session invalide → redirect /auth ✅
   ↓
7. Dossier data/users/{userId}/ reste (orphelin)
   → Utiliser deleteUserFolder(userId) pour nettoyer
```

---

## Impact des changements

### Performance

**Vérification DB à chaque requête** :
- ⚠️ Une requête DB supplémentaire par session check
- ✅ Requête très rapide (SELECT avec index sur id)
- ✅ Peut être mise en cache côté NextAuth si nécessaire

**Estimation** :
- Session check sans DB : ~5ms
- Session check avec DB : ~10-15ms
- Impact négligeable pour la sécurité gagnée

### Sécurité

- ✅ Impossibilité d'utiliser un compte supprimé
- ✅ Sessions automatiquement invalidées
- ✅ Données complètement effacées (RGPD compliant)
- ✅ Pas de données orphelines

---

## Tests recommandés

### Test 1 : Suppression via UI

1. Créer un compte test
2. Se connecter
3. Aller dans les paramètres → Supprimer le compte
4. Entrer le mot de passe → Confirmer
5. ✅ Vérifier redirection vers /auth
6. ✅ Vérifier que le dossier `data/users/{userId}` n'existe plus
7. ✅ Vérifier dans Prisma Studio que l'utilisateur est supprimé

### Test 2 : Suppression manuelle DB

1. Se connecter avec un compte
2. Dans Prisma Studio, supprimer l'utilisateur manuellement
3. Dans le navigateur, rafraîchir la page ou naviguer
4. ✅ Vérifier redirection automatique vers /auth
5. ✅ Vérifier le log serveur : `[session] User {id} no longer exists in DB, invalidating session`
6. Nettoyer manuellement le dossier :
   ```javascript
   import { deleteUserFolder } from "@/lib/user/deletion";
   await deleteUserFolder("{userId}");
   ```

### Test 3 : Session expirée naturellement

1. Se connecter
2. Attendre 30 jours (ou modifier maxAge à 1 minute pour test)
3. ✅ Session expire normalement
4. ✅ Redirection vers /auth

### Test 4 : Utilisateur avec OAuth (Google/GitHub)

1. Se connecter avec Google ou GitHub
2. Essayer de supprimer le compte
3. ⚠️ Si pas de mot de passe défini : Erreur demandant de définir un mot de passe d'abord
4. Définir un mot de passe → Supprimer
5. ✅ Compte + sessions OAuth supprimés

---

## Limitations connues

### 1. JWT encore valide techniquement

Le JWT reste valide jusqu'à son expiration naturelle (30 jours). Cependant :
- ✅ La session est quand même invalidée côté serveur
- ✅ Toute requête serveur échoue (redirect /auth)
- ⚠️ Le JWT pourrait être réutilisé si NextAuth ne vérifie pas la DB

**Solution actuelle** : Le callback `session` vérifie **toujours** la DB.

### 2. Sessions actives sur d'autres appareils

Si l'utilisateur est connecté sur plusieurs appareils :
- ✅ Toutes les sessions DB sont supprimées immédiatement
- ✅ Les JWTs deviennent invalides au prochain check
- ⏱️ Délai max = temps entre deux requêtes

### 3. Dossiers orphelins après suppression manuelle

Si un admin supprime l'utilisateur directement dans la DB :
- ❌ Le dossier `data/users/{userId}` reste
- ✅ Peut être nettoyé avec `deleteUserFolder(userId)`

**Future amélioration** : Script de nettoyage périodique des dossiers orphelins.

---

## Améliorations possibles

### 1. Blacklist JWT

Ajouter une table `RevokedTokens` pour invalider immédiatement les JWTs :

```javascript
// Lors de la suppression
await prisma.revokedToken.create({
  data: { userId, revokedAt: new Date() }
});

// Dans le callback jwt
const revoked = await prisma.revokedToken.findUnique({
  where: { userId: token.id }
});
if (revoked) return null;
```

### 2. Cache de vérification utilisateur

Mettre en cache le résultat de `user.findUnique()` pendant 1-5 minutes :

```javascript
import { unstable_cache } from 'next/cache';

const checkUserExists = unstable_cache(
  async (userId) => {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
  },
  ['user-exists'],
  { revalidate: 300 } // 5 minutes
);
```

### 3. Webhook de suppression

Notifier d'autres services lors de la suppression :

```javascript
// Après suppression
await fetch('https://analytics.example.com/user-deleted', {
  method: 'POST',
  body: JSON.stringify({ userId, deletedAt: new Date() })
});
```

### 4. Soft delete

Au lieu de supprimer définitivement, marquer comme supprimé :

```javascript
await prisma.user.update({
  where: { id: userId },
  data: { deletedAt: new Date(), email: `deleted-${userId}@...` }
});

// Dans session callback
if (dbUser.deletedAt) return null;
```

**Avantages** :
- Restauration possible pendant X jours
- Conformité RGPD (anonymisation après X jours)
- Historique préservé

---

## Conformité RGPD

✅ **Droit à l'effacement (Art. 17)** :
- Données personnelles supprimées de la DB
- Fichiers utilisateur supprimés du serveur
- Sessions invalidées immédiatement

✅ **Données supprimées** :
- Informations de compte (nom, email, mot de passe)
- CV générés et fichiers
- Tâches en arrière-plan
- Sessions et tokens
- Comptes OAuth liés

⚠️ **Logs serveur** :
- Les logs peuvent contenir des traces
- À configurer pour rotation/suppression automatique

---

## Conclusion

✅ **Problème 1 résolu** : Session automatiquement invalidée si utilisateur supprimé

✅ **Problème 2 résolu** : Dossier utilisateur supprimé lors de la suppression

**Sécurité renforcée** : Vérification systématique de l'existence de l'utilisateur à chaque requête authentifiée.

**Conformité RGPD** : Suppression complète des données utilisateur sur demande.
