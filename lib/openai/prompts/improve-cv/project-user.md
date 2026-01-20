## PROJET EXISTANT (null si creation)

```json
{{existingProject}}
```

---

## OFFRE D'EMPLOI CIBLEE

**Titre :** {{jobTitle}}

**Competences cles recherchees :**
{{jobKeySkills}}

**Contexte complet :**
```json
{{jobOfferContent}}
```

---

## SUGGESTION A APPLIQUER

**Suggestion :** {{suggestionText}}

**Contexte utilisateur :** {{userContext}}

**Action attendue :** {{actionDescription}}

---

## RAPPEL

1. Verifier que ce projet/modification est PERTINENT pour l'offre ci-dessus
2. Ne rien inventer - tout doit provenir du contexte utilisateur
3. Inclure le `reasoning` dans la reponse

---

## CHECKLIST FINALE

- [ ] `isNew` correct (true si creation, false si amelioration)
- [ ] Mode creation : name, summary, tech_stack, role presents
- [ ] Aucune techno inventee
- [ ] Summary : 2-3 phrases max
- [ ] URL incluse si applicable (GitHub, portfolio, demo)
- [ ] Contenu en **{{cvLanguage}}**
