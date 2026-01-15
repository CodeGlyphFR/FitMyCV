---
name: cv-prompt-engineering
description: Guide pour rediger des prompts IA optimises pour la generation de CV. Utiliser lors du travail sur lib/openai/prompts/ et lib/openai/schemas/. Combine expertise prompt engineering et regles metier CV 2025 France.
---

# CV Prompt Engineering

Ce skill guide la redaction de prompts OpenAI pour generer des CV professionnels optimises.

## Quand utiliser ce skill

- Creation ou modification de prompts dans `lib/openai/prompts/`
- Modification des schemas dans `lib/openai/schemas/`
- Audit et amelioration des prompts existants
- Debug de problemes de qualite de sortie GPT

## Objectif

Ecrire des prompts qui permettent a GPT de generer du contenu CV :
- **Professionnel** : ton adapte au marche francais
- **Optimise ATS** : structure et mots-cles compatibles
- **Authentique** : contenu defendable en entretien
- **Adapte** : personnalise selon le profil (junior/confirme/senior)

## Principes fondamentaux

### 1. Clarte des instructions
GPT execute litteralement ce qu'on lui demande. Chaque instruction doit etre :
- **Explicite** : pas d'implicite ni de sous-entendus
- **Actionnable** : verbe d'action + resultat attendu
- **Mesurable** : criteres de succes verifiables

### 2. Structure hierarchique
Organiser les prompts du general au specifique :
1. Role et contexte
2. Mission principale
3. Regles et contraintes
4. Format de sortie
5. Exemples (si necessaire)

### 3. Separation des preoccupations
- **system.md** : identite, regles permanentes, contraintes
- **user.md** : donnees variables, instructions specifiques a la requete

## Documentation de reference

Pour les details, consulter :
- [PROMPT_ENGINEERING.md](PROMPT_ENGINEERING.md) : Techniques d'ecriture de prompts efficaces
- [REGLES_CV_METIER.md](REGLES_CV_METIER.md) : Regles metier CV 2025 France
- [EXEMPLES_PROMPTS.md](EXEMPLES_PROMPTS.md) : Patterns et exemples concrets

## Checklist avant validation

- [ ] Le prompt definit clairement le role de l'IA
- [ ] Les regles metier CV sont explicitement mentionnees
- [ ] Le format de sortie est specifie (JSON, structure)
- [ ] Les contraintes (longueur, ton, langue) sont definies
- [ ] Les cas limites sont geres (profil junior vs senior)
- [ ] Le prompt interdit les inventions/hallucinations
- [ ] Les exemples illustrent le resultat attendu
