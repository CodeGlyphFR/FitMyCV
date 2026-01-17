## RESUME ACTUEL DU CV

```json
{summaryContent}
```

---

## OFFRE D'EMPLOI (pour alignement vocabulaire)

```json
{jobOfferContent}
```

---

## AMELIORATIONS APPORTEES AUX EXPERIENCES

```json
{improvedExperiences}
```

---

## AMELIORATIONS APPORTEES AUX PROJETS

```json
{improvedProjects}
```

---

## ANALYSE REQUISE

En analysant les ameliorations apportees :

1. **Y a-t-il de nouveaux accomplissements majeurs** qui meritent d'etre reflete dans la description ?
2. **Le vocabulaire de la description** doit-il etre ajuste pour mieux matcher l'offre ?

Si AUCUNE modification n'est justifiee, retourne :
```json
{
  "modifications": {},
  "reasoning": "Le summary actuel est deja coherent avec les ameliorations apportees."
}
```

---

## VALIDATIONS AVANT REPONSE

1. [ ] La description fait 40-60 mots si modifiee
2. [ ] Chaque modification est justifiee par les ameliorations
3. [ ] Aucune invention - tout vient des ameliorations ou du summary existant
4. [ ] Les annees d'experience n'ont PAS ete modifiees

---

## LANGUE DE SORTIE

Tous les champs textuels doivent etre en **{cvLanguage}**.
