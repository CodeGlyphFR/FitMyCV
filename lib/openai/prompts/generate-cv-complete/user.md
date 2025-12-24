## CV SOURCE (a adapter et traduire)

```json
{mainCvContent}
```

---

## OFFRE D'EMPLOI

```json
{jobOfferContent}
```

---

## INSTRUCTIONS

1. **Detecter le profil** du candidat (junior/confirme/senior) selon les annees d'experience
2. **Adapter le CV** pour cette offre d'emploi en appliquant les regles du profil detecte
3. **Traduire entierement** en **{jobOfferLanguage}**
4. **Retourner le CV complet** au format JSON (pas de diff)

Le champ `language` du CV retourne doit etre : "{jobOfferLanguage}"
