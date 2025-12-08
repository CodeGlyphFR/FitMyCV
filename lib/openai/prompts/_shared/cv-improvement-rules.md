```json
{
  "cv_improvement_rules": {
    "strict_prohibitions": [
      "Inventer des expériences ou compétences absentes du CV original",
      "Modifier des faits concrets (dates, noms d'entreprises, diplômes)",
      "Ajouter des certifications ou formations non obtenues",
      "Exagérer le niveau de maîtrise d'une compétence",
      "Inventer des métriques ou chiffres"
    ],
    "allowed_actions": [
      "Reformuler pour valoriser l'existant",
      "Réorganiser par pertinence",
      "Adapter le vocabulaire à l'offre d'emploi",
      "Optimiser les mots-clés ATS",
      "Détailler responsabilités et impacts quantifiables",
      "Clarifier réalisations et livrables",
      "Ajouter des compétences SI justifiées par l'expérience"
    ],
    "ats_optimization": {
      "keywords": {
        "source": "termes exacts de l'offre",
        "format": "formes standards (JavaScript pas JS)",
        "repetition": "mots-clés critiques dans plusieurs sections"
      },
      "structure": {
        "order": "informations pertinentes en premier",
        "verbs": ["Géré", "Développé", "Optimisé", "Piloté", "Conçu", "Déployé", "Réduit", "Augmenté"],
        "metrics": "quantifier si possible (%, €, nombre)"
      }
    },
    "section_rules": {
      "summary": {
        "actions": [
          "Ne pas inventer de compétences"
          "Reformuler pour matcher le poste uniquement si justifiable par l'expérience",
          "Mettre en avant l'expertise pertinente uniquement si justifiable par l'expérience",
          "Utiliser le vocabulaire de l'offre"
        ]
      },
      "title": {
        "actions": [
          "Adapter au poste visé",
          "Rester cohérent avec l'expérience",
          "Utiliser des titres standards ATS"
        ]
      },
      "experience": {
        "actions": [
          "RÉÉCRIRE responsibilities et deliverables avec le vocabulaire exact de l'offre",
          "COMPLÉTER avec éléments que l'utilisateur aurait pu oublier SI fortement liés à l'expérience",
          "Adapter le wording pour matcher les mots-clés ATS de l'offre",
          "Si la description est déjà bonne, ne pas réécrire - juste ajuster le wording",
          "Ajouter des métriques de performance si possible",
          "PRIORISER : détailler les postes en lien direct avec l'offre (3-5 bullets), réduire les autres à 1-2 lignes"
        ],
        "constraints": [
          "NE JAMAIS inventer d'expériences ou responsabilités",
          "NE PAS réorganiser les expériences (ordre chronologique imposé par l'affichage)",
          "Rester fidèle à ce que l'utilisateur a réellement fait",
          "Chaque ajout doit être défendable en entretien"
        ],
        "format": {
          "header": "Intitulé du poste, Nom entreprise, Lieu, Dates (mois/année)",
          "description": "1-2 phrases maximum, directe et percutante",
          "bullets_count": {
            "pertinent": "3-5 bullet points max pour expériences directement liées à l'offre",
            "secondaire": "1-2 bullet points pour expériences moins pertinentes"
          },
          "bullet_formula": "[Verbe action infinitif] + [tâche précise] + [résultat chiffré]",
          "responsibilities": "Max 10-15 mots par bullet point, commencer par un verbe d'action à l'infinitif",
          "deliverables": "Max 10-15 mots par bullet point, résultat concret et mesurable",
          "style": "Concis, factuel, pas de phrases longues ou verbeuses"
        }
      },
      "skills": {
        "actions": [
          "Réorganiser par priorité selon l'offre (skills matchés en premier)",
          "RETIRER les compétences clairement hors-sujet pour le poste (ex: Excel pour un poste DevOps)",
          "Noms courts mais standards ATS",
          "Grouper compétences connexes",
          "Ajouter UNIQUEMENT si justifié par l'expérience"
        ]
      }
    },
    "experience_levels": {
      "notions": "stages, petits projets, scolaire",
      "debutant": "~1 an",
      "intermediaire": "2-3 ans",
      "competent": "appliqué en expérience/projet",
      "avance": "3-7 ans",
      "expert": "7+ ans"
    },
    "quality_check": [
      "Tout est factuel et vérifiable",
      "Pas de superlatifs excessifs",
      "Ton professionnel",
      "Cohérence entre sections",
      "Chaque ajout justifiable en entretien"
    ]
  }
}
```

Workflow obligatoire :
1. ANALYSER l'offre d'emploi → identifier secteur + mots-clés
2. VÉRIFIER que chaque modification respecte strict_prohibitions
3. APPLIQUER improvement_rules pour optimiser le contenu
4. FILTRER avec humanization_rules.banned_words.[secteur]
5. FORMATER avec bullet_format.method CAR
6. VALIDER avec quality_check

Règle absolue : ne jamais inventer, ne jamais utiliser de mots bannis.