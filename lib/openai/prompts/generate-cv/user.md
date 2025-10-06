ANALYSE L'OFFRE ET ADAPTE LE CV

## 1️⃣ ANALYSE RAPIDE DE L'OFFRE

Identifie:
- Les compétences **CRITIQUES** (must-have)
- Les compétences **BONUS** (nice-to-have)
- Le niveau d'expérience requis
- Le vocabulaire et mots-clés importants

## 2️⃣ ADAPTATION DU CV

À partir du CV de référence ci-dessous, crée un CV optimisé qui:

✅ **Met en avant** les compétences demandées dans l'offre
✅ **Adapte le summary** pour correspondre au poste
✅ **Réorganise les expériences** pour valoriser les plus pertinentes
✅ **Ajuste le titre professionnel** (current_title) pour matcher l'offre
✅ **Optimise les mots-clés** pour l'ATS

❌ **N'invente JAMAIS** d'expériences ou compétences absentes du CV original

## 3️⃣ CALCUL DU SCORE DE MATCH (0-100)

Évalue objectivement selon 4 catégories (chacune sur 100):

| Catégorie | Poids | Description |
|-----------|-------|-------------|
| Compétences techniques | 35% | Technologies, outils, frameworks |
| Expérience | 30% | Années, responsabilités, secteur |
| Formation | 20% | Diplômes, certifications |
| Soft skills & Langues | 15% | Compétences comportementales + langues |

**Formule** : `score = (tech × 0.35) + (exp × 0.30) + (edu × 0.20) + (soft × 0.15)`

## 4️⃣ SUGGESTIONS D'AMÉLIORATION

Liste **3-5 actions concrètes** pour améliorer le score, par ordre de priorité.

---

## FORMAT DE RÉPONSE OBLIGATOIRE (JSON)

```json
{
  "adapted_cv": {
    // Le CV adapté complet au format du CV de référence
  },
  "match_score": 75,
  "score_breakdown": {
    "technical_skills": 80,
    "experience": 73,
    "education": 75,
    "soft_skills_languages": 67
  },
  "improvement_suggestions": [
    {
      "title": "Ajouter certification AWS",
      "suggestion": "Ajouter la certification AWS Solution Architect mentionnée comme un atout dans l'offre",
      "priority": "high",
      "impact": "+8 points"
    },
    {
      "title": "Détailler gestion d'équipe",
      "suggestion": "Détailler davantage votre expérience en gestion d'équipe avec des exemples concrets",
      "priority": "medium",
      "impact": "+5 points"
    }
  ],
  "missing_critical_skills": ["Kubernetes", "TypeScript"],
  "matching_skills": ["React", "Node.js", "Docker", "MongoDB"]
}
```

---

## CV DE RÉFÉRENCE

```json
{mainCvContent}
```

---

## OFFRE D'EMPLOI

{jobOfferContent}

---

⚠️ **IMPORTANT** : Réponds UNIQUEMENT avec le JSON, sans texte additionnel.
