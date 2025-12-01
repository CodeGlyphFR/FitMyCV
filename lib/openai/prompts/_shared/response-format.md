# FORMAT DE RÉPONSE

Cette directive s'applique à toutes les fonctions retournant du JSON.

## RÈGLE ABSOLUE

⚠️ **IMPORTANT** : Réponds **UNIQUEMENT** avec le JSON final, sans texte avant ou après.

## INTERDICTIONS

❌ **NE PAS** ajouter de texte explicatif avant le JSON
❌ **NE PAS** ajouter de commentaires après le JSON
❌ **NE PAS** utiliser de blocs markdown autour du JSON (pas de \`\`\`json)
❌ **NE PAS** inclure de phrases comme "Voici le JSON" ou "Le résultat est"

## FORMAT ATTENDU

La réponse doit commencer directement par `{` et se terminer par `}`.

### ✅ CORRECT

```
{
  "field": "value",
  "array": [1, 2, 3]
}
```

### ❌ INCORRECT

```
Voici le JSON demandé :
```json
{
  "field": "value"
}
```
Voilà, c'est terminé !
```

## VALIDATION JSON

Avant de répondre, assure-toi que :
- Le JSON est **valide** (pas d'erreurs de syntaxe)
- Toutes les clés sont entre guillemets doubles
- Les tableaux vides sont représentés par `[]` (pas `null`)
- Les valeurs null sont écrites `null` (pas `"null"`)
- Pas de virgule finale dans les objets ou tableaux
- Tous les guillemets et accolades sont correctement fermés
- Chaque chaine de caractère dans "skills" dans le champ "name" de "hard_skills", "soft_skills", "tools" et "methodologies" **DOIVENT ABSOLUEMENT commencer par une MAJUSCULE**.
- ⛔ Les **LOGICIELS** (Excel, Photoshop, SAP, SolidWorks, Matlab, Figma, etc.) vont **UNIQUEMENT** dans "tools", **JAMAIS** dans "hard_skills"

## CAS SPÉCIAUX

### Valeurs vides
- Chaînes vides : `""`
- Tableaux vides : `[]`
- Objets vides : `{}`
- Absence de valeur : `null`

### Caractères spéciaux
- Échapper les guillemets dans les valeurs : `"Il a dit \"oui\""`
- Échapper les backslashes : `"chemin\\vers\\fichier"`
- Les sauts de ligne dans les valeurs : `\n`
