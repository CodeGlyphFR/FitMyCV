## CV SOURCE A ADAPTER

```json
{mainCvContent}
```

---

## OFFRE D'EMPLOI CIBLE

```json
{jobOfferContent}
```

---

## TA MISSION

1. **Analyse d'abord** : Remplis la section `analysis` en reflechissant au profil du candidat et a l'offre
2. **Decide ensuite** : Determine les modifications necessaires pour chaque section
3. **Genere enfin** : Produis le JSON de modifications

**RAPPELS CRITIQUES** :
- Le summary doit refleter le VRAI parcours du candidat (pas pretendre X ans dans un domaine ou il n'a travaille que Y ans)
- Ne supprime des competences QUE si elles sont completement hors-domaine
- Chaque modification doit etre justifiable en entretien
- Langue de sortie : **{jobOfferLanguage}**

Retourne le JSON complet avec `analysis`, `modifications` et `reasoning`.
