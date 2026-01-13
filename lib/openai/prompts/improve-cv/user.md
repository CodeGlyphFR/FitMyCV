AMELIORATION CIBLEE DU CV

## DONNEES D'ENTREE

Tu as recu :
1. Les sections `summary`, `experience` et `projects` du CV (les seules modifiables)
2. L'offre d'emploi analysee (pour aligner le vocabulaire)
3. Les suggestions d'amelioration selectionnees par l'utilisateur (avec contexte optionnel)

---

## OFFRE D'EMPLOI (pour alignement vocabulaire)

{jobOfferContent}

---

## RESUME DU CV (SUMMARY)

{summaryContent}

---

## EXPERIENCES DU CV

{experienceContent}

---

## PROJETS DU CV

{projectsContent}

---

## SUGGESTIONS A APPLIQUER

{suggestionsText}

---

## RAPPEL : DELIVERABLES = COURTS (max 25 caracteres)

| ❌ Trop long | ✅ Correct |
|--------------|------------|
| "Reduction de 60% du temps de reponse" | "-60% temps reponse" |
| "Augmentation de la productivite de 30%" | "+30% productivite" |
| "5 developpeurs recrutes et formes" | "5 devs formes" |

---

## FORMAT DE REPONSE OBLIGATOIRE (JSON)

```json
{
  "reasoning": {
    "suggestions_analysis": [
      {
        "suggestion_index": 0,
        "user_context": "J'ai reduit le temps de 60% et gere le deploiement",
        "extracted_metrics": [
          {
            "value": "-60% temps reponse",
            "target_field": "deliverables",
            "associated_responsibility": "Optimiser les performances de l'API"
          }
        ],
        "extracted_actions": [
          {
            "description": "Gerer le deploiement en production",
            "target_field": "responsibilities"
          }
        ],
        "target_experience": {
          "reference": "avant-derniere experience",
          "resolved_index": 1,
          "resolved_company": "TechCorp",
          "end_date": "2023-06"
        },
        "bullets_check": {
          "responsibilities_count": 4,
          "deliverables_count": 5,
          "needs_replacement": true,
          "deliverable_to_remove": "Ancien resultat peu pertinent",
          "removal_reason": "Moins lie au poste IA"
        }
      }
    ],
    "global_strategy": "Ajout de 2 deliverables et 2 responsibilities dans l'experience TechCorp"
  },

  "modifications": {
    "experience": {
      "updates": [
        {
          "index": 1,
          "company": "TechCorp",
          "changes": {
            "responsibilities": {
              "add": [
                "Optimiser les performances de l'API",
                "Gerer le deploiement en production"
              ]
            },
            "deliverables": {
              "add": ["-60% temps reponse"],
              "remove": ["Ancien resultat peu pertinent"]
            }
          }
        }
      ]
    }
  },

  "changes_summary": [
    {
      "section": "experience",
      "field": "responsibilities",
      "path": "experience[1].responsibilities",
      "expIndex": 1,
      "changeType": "added",
      "itemName": "Optimiser les performances de l'API",
      "afterValue": "Optimiser les performances de l'API",
      "change": "Ajout de la responsabilite associee au resultat chiffre",
      "reason": "Action qui a permis d'obtenir -60% temps reponse"
    },
    {
      "section": "experience",
      "field": "deliverables",
      "path": "experience[1].deliverables",
      "expIndex": 1,
      "changeType": "removed",
      "itemName": "Ancien resultat peu pertinent",
      "beforeValue": "Ancien resultat peu pertinent",
      "change": "Suppression pour faire place au nouveau resultat",
      "reason": "Moins pertinent pour le poste IA"
    },
    {
      "section": "experience",
      "field": "deliverables",
      "path": "experience[1].deliverables",
      "expIndex": 1,
      "changeType": "added",
      "itemName": "-60% temps reponse",
      "afterValue": "-60% temps reponse",
      "change": "Ajout du resultat chiffre",
      "reason": "Resultat mesurable fourni par l'utilisateur"
    }
  ]
}
```

---

## REGLES CRITIQUES

### 1. Deliverables COURTS (max 25 caracteres)
- ❌ "Reduction de 60% du temps de reponse des APIs"
- ✅ "-60% temps reponse"

### 2. UN resultat = UN deliverable
Si le contexte contient 2 chiffres → 2 deliverables separes

### 3. Responsabilite ASSOCIEE obligatoire
Pour chaque deliverable ajoute, ajouter aussi la responsabilite (verbe infinitif, SANS chiffre)

### 4. Limite de 5 bullets
Si 5 bullets existent et ajout necessaire :
- `remove` le moins pertinent
- puis `add` le nouveau

### 5. Experience ciblee par DATES
- "Derniere" = `end_date: null` ou plus recente
- "Avant-derniere" / "Precedente" = celle juste avant chronologiquement

---

## FORMAT changes_summary

Chaque modification DOIT avoir :
- `section` : "summary", "experience" ou "projects"
- `field` : Le champ modifie
- `path` : Chemin complet (ex: "experience[1].deliverables")
- `expIndex` : Index de l'experience/projet
- `changeType` : "added", "removed", "modified"
- `itemName` : Valeur concernee
- `beforeValue` : Valeur avant (pour removed/modified)
- `afterValue` : Valeur apres (pour added/modified)
- `change` : Description en **{cvLanguage}**
- `reason` : Justification en **{cvLanguage}**

---

## VALIDATIONS FINALES

Avant de generer ta reponse, verifie :

1. [ ] Chaque deliverable fait max 25 caracteres
2. [ ] Chaque resultat chiffre a sa responsabilite associee (sans chiffre)
3. [ ] Si plusieurs resultats dans le contexte → plusieurs deliverables separes
4. [ ] Aucun champ ne depasse 5 bullets apres modification
5. [ ] L'experience ciblee est basee sur les DATES (pas l'index)

---

## LANGUE DE SORTIE

Tous les champs textuels doivent etre en **{cvLanguage}**.
