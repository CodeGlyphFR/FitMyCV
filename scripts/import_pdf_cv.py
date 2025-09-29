#!/usr/bin/env python3
"""
Script d'import d'un CV PDF via l'API ChatGPT.

Ce script reçoit un fichier PDF via la variable d'environnement GPT_PDF_IMPORT_PAYLOAD,
injectée par la route Next.js /api/chatgpt/import-pdf.

Le script utilise ChatGPT pour extraire les informations du PDF et les convertir
en JSON suivant la structure du CV raw (main.json).

Prérequis :
  - python >= 3.9
  - pip install "openai>=1.12"
  - définir la variable d'environnement OPENAI_API_KEY
  - optionnel : OPENAI_MODEL (par défaut gpt-4.1-mini)
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_SYSTEM_PROMPT = (
    "Tu es un assistant spécialisé dans l'extraction et la structuration d'informations de CV au format PDF.\n"
    "Tu dois analyser le CV fourni et remplir le template JSON vierge avec les informations extraites du PDF.\n"
    "Tu dois respecter EXACTEMENT la structure JSON du template fourni - ne modifie aucun nom de champ.\n"
    "Si une information n'est pas disponible dans le CV PDF, génère l'information à partir des éléments du CV.\n"
    "Assure-toi que le JSON final soit valide et bien formaté.\n"
)

DEFAULT_USER_PROMPT = (
    "Analyse le CV PDF fourni et remplis le template JSON vierge avec les informations extraites.\n\n"
    "Instructions détaillées :\n\n"
    "1. HEADER - Informations personnelles :\n"
    "   - full_name : nom et prénom complets\n"
    "   - current_title : titre professionnel actuel\n"
    "   - contact.email : adresse email\n"
    "   - contact.phone : numéro de téléphone\n"
    "   - contact.links : liens professionnels (LinkedIn, portfolio, etc.)\n"
    "   - contact.location : ville, région, code pays\n\n"
    "2. SUMMARY :\n"
    "   - description : résumé professionnel ou objectif de carrière\n"
    "   - domains : domaines d'expertise (tableau de strings)\n\n"
    "3. SKILLS :\n"
    "   - hard_skills : compétences techniques spécialisées sans commentaires et détermine à partir de l'expérience le niveau de chaque compétence pour remplir le champ proficiency\n"
    "   - soft_skills : compétences comportementales sans commentaires et détermine à partir de l'expérience le niveau de chaque compétence pour remplir le champ proficiency\n"
    "   - tools : outils et technologies maîtrisés sans commentaires et détermine à partir de l'expérience le niveau de chaque compétence pour remplir le champ proficiency\n"
    "   - methodologies : méthodologies de travail (Agile, SCRUM, etc.)\n\n"
    "4. EXPERIENCE : tableau d'objets avec :\n"
    "   - title : intitulé du poste\n"
    "   - company : nom de l'entreprise\n"
    "   - start_date / end_date : dates au format 'YYYY-MM' ou 'YYYY'. Si la end_date correspond à aujoud'hui écrire 'present'\n"
    "   - description : fait une description de la missions breve de la mission\n"
    "   - responsibilities: définit les responsabilités de la mission\n"
    "   - deliverables: liste les livrables produits\n"
    "   - skills_used: définit les skills appliqués sur la mission\n"
    "   - location : lieu de travail\n\n"
    "5. EDUCATION :\n"
    "   - formation avec diplômes, écoles, années. Si il y a une indication mentionant que c'est en cours, écrire 'present' dans end_date\n"
    "   - il faut remplir les champs institution, degree, field_of_study, location\n\n"
    "6. LANGUAGES : langues avec niveaux, il faut remplir les champs name et level\n\n"
    "7. PROJECTS : projets personnels uniquement si précisé, le laisser vide si ce n'est pas le cas\n\n"
    "8. EXTRAS : informations complémentaires (certifications, hobbies, etc.) uniquement si précisé, le laisser vide si ce n'est pas le cas\n\n"
    "IMPORTANT : Remplis le champ 'generated_at' avec la date actuelle au format ISO.\n"
    "Ne modifie pas les champs 'order_hint' et 'section_titles'.\n"
    "Réponds UNIQUEMENT avec le JSON final complet, sans texte avant ou après.\n"
)


def load_payload() -> Dict[str, Any]:
    payload_json = os.environ.get("GPT_PDF_IMPORT_PAYLOAD")
    if not payload_json:
        raise ValueError("Variable d'environnement GPT_PDF_IMPORT_PAYLOAD manquante.")
    try:
        payload = json.loads(payload_json)
    except json.JSONDecodeError as exc:
        raise ValueError("Payload GPT_PDF_IMPORT_PAYLOAD invalide.") from exc
    return payload


def get_openai_client(payload_model=None):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY est manquant.")

    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError(
            "Le script nécessite la version 1.0+ du SDK openai. Consultez la documentation et installez `pip install --upgrade openai`."
        ) from exc

    client = OpenAI(api_key=api_key)
    model = (
        payload_model
        or os.environ.get("GPT_OPENAI_MODEL")
        or os.environ.get("OPENAI_MODEL")
        or os.environ.get("OPENAI_API_MODEL")
        or "gpt-4.1-mini"
    )
    return client, model


def upload_pdf_file(client, pdf_path: Path) -> Optional[Dict[str, Any]]:
    try:
        with pdf_path.open("rb") as handle:
            remote = client.files.create(file=handle, purpose="assistants")

        return {
            "id": remote.id,
            "name": pdf_path.name,
            "source_path": str(pdf_path),
        }
    except Exception as exc:
        print(f"[ERREUR] Impossible d'uploader le PDF {pdf_path}: {exc}", file=sys.stderr)
        return None


def get_cv_schema() -> Optional[str]:
    """Récupère le schéma du CV template pour la structure de référence."""
    project_root = Path(__file__).resolve().parent.parent
    template_path = project_root / "data" / "template.json"

    try:
        if template_path.exists():
            print(f"[INFO] Utilisation du template : {template_path}", file=sys.stderr)
            return template_path.read_text(encoding="utf-8")
    except Exception as exc:
        print(f"[AVERTISSEMENT] Impossible de lire template.json: {exc}", file=sys.stderr)

    # Fallback vers le CV utilisateur si le template n'existe pas
    user_cv_dir = os.environ.get("GPT_USER_CV_DIR")
    if user_cv_dir:
        main_cv_path = Path(user_cv_dir) / "main.json"
        try:
            if main_cv_path.exists():
                print(f"[INFO] Fallback vers main.json utilisateur", file=sys.stderr)
                return main_cv_path.read_text(encoding="utf-8")
        except Exception as exc:
            print(f"[AVERTISSEMENT] Impossible de lire main.json: {exc}", file=sys.stderr)

    # Schéma par défaut si aucun template n'est trouvé
    print("[INFO] Utilisation du schéma par défaut", file=sys.stderr)
    default_schema = {
        "generated_at": "",
        "header": {
            "full_name": "",
            "current_title": "",
            "contact": {
                "email": "",
                "phone": "",
                "links": [],
                "location": {
                    "city": "",
                    "region": "",
                    "country_code": ""
                }
            }
        },
        "summary": {
            "description": "",
            "domains": []
        },
        "skills": {
            "hard_skills": [],
            "soft_skills": [],
            "tools": [],
            "methodologies": []
        },
        "experience": [],
        "education": [],
        "languages": [],
        "extras": [],
        "projects": [],
        "order_hint": [
            "header",
            "summary",
            "skills",
            "experience",
            "education",
            "languages",
            "extras",
            "projects"
        ],
        "section_titles": {
            "summary": "Résumé",
            "skills": "Compétences",
            "experience": "Expérience",
            "education": "Éducation",
            "languages": "Langues",
            "extras": "Informations complémentaires",
            "projects": "Projets personnels"
        },
        "meta": {
            "generator": "pdf-import",
            "source": "pdf-import",
            "created_at": "",
            "updated_at": ""
        }
    }
    return json.dumps(default_schema, indent=2, ensure_ascii=False)


def build_user_prompt(base_prompt: str, cv_schema: str) -> str:
    sections = []

    if base_prompt.strip():
        sections.append(base_prompt.strip())

    sections.append(
        "\nTEMPLATE JSON À REMPLIR (respecte exactement cette structure) :\n"
        "```json\n"
        f"{cv_schema.strip()}\n"
        "```"
    )

    sections.append(
        "\nTon travail : Analyse le CV PDF et remplis ce template avec les informations extraites.\n"
        "Retourne UNIQUEMENT le JSON final complet et valide, sans commentaires ni texte additionnel."
    )

    return "\n".join(sections)


def call_chatgpt(client, model: str, system_prompt: str, user_prompt: str, pdf_file: Dict[str, Any]) -> Dict[str, Any]:
    user_content = [
        {"type": "input_text", "text": user_prompt},
        {"type": "input_file", "file_id": pdf_file["id"]}
    ]

    try:
        response = client.responses.create(
            model=model,
            instructions=system_prompt,
            input=[
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
    except TypeError:
        response = client.responses.create(
            model=model,
            instructions=system_prompt,
            input=[
                {"role": "user", "content": user_content},
            ],
        )

    # Extraction de la réponse
    if hasattr(response, "output_text") and response.output_text:
        return {"type": "text", "content": str(response.output_text).strip()}

    text_chunks = []
    for block in getattr(response, "output", []) or []:
        for item in getattr(block, "content", []) or []:
            item_type = getattr(item, "type", None)
            if item_type == "output_text":
                text_chunks.append(getattr(item, "text", ""))

    if text_chunks:
        result = "\n\n".join(chunk.strip() for chunk in text_chunks if chunk)
        if result:
            return {"type": "text", "content": result}

    # Fallback
    try:
        serialized = response.model_dump()
    except AttributeError:
        serialized = json.loads(response.model_dump_json())
    return {"type": "text", "content": json.dumps(serialized, indent=2, ensure_ascii=False)}


def ensure_response_directory() -> Path:
    default_dir = Path(__file__).resolve().parent.parent / "data" / "cvs"
    user_dir = os.environ.get("GPT_USER_CV_DIR")
    target_dir = Path(user_dir) if user_dir else default_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir


def derive_filename() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    return f"imported_{timestamp}"


def save_output_file(content: str, target_dir: Path, base_name: str) -> Path:
    output_path = target_dir / f"{base_name}.json"
    backup_counter = 1
    while output_path.exists():
        output_path = target_dir / f"{base_name}_{backup_counter}.json"
        backup_counter += 1

    # Enrichir avec les métadonnées et dates
    try:
        parsed = json.loads(content)
        iso_now = datetime.now(timezone.utc).isoformat()

        # Remplir le champ generated_at s'il est vide
        if "generated_at" in parsed and not parsed["generated_at"]:
            parsed["generated_at"] = iso_now[:10]  # Format YYYY-MM-DD

        # Enrichir les métadonnées
        meta = {
            "created_at": iso_now,
            "updated_at": iso_now,
            "generator": "pdf-import",
            "source": "pdf-import"
        }
        if "meta" in parsed:
            parsed["meta"].update(meta)
        else:
            parsed["meta"] = meta

        enriched_content = json.dumps(parsed, indent=2, ensure_ascii=False)
        output_path.write_text(enriched_content, encoding="utf-8")
    except (json.JSONDecodeError, KeyError):
        # Si le parsing JSON échoue, on sauvegarde le contenu tel quel
        output_path.write_text(content, encoding="utf-8")

    return output_path


def normalize_json_payload(raw: str) -> str:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON invalide retourné par ChatGPT: {exc}") from exc
    return json.dumps(data, indent=2, ensure_ascii=False)


def main() -> int:
    try:
        payload = load_payload()
    except Exception as exc:
        print(f"[ERREUR] Chargement du payload impossible : {exc}", file=sys.stderr)
        return 1

    pdf_file_path = payload.get("pdf_file_path")
    if not pdf_file_path:
        print("[ERREUR] Chemin du fichier PDF manquant dans le payload.", file=sys.stderr)
        return 1

    pdf_path = Path(pdf_file_path)
    if not pdf_path.exists():
        print(f"[ERREUR] Fichier PDF introuvable : {pdf_path}", file=sys.stderr)
        return 1

    payload_model = payload.get("model")
    analysis_level = payload.get("analysis_level", "medium")

    print(f"[INFO] Traitement du fichier PDF : {pdf_path.name}")
    print(f"[INFO] Niveau d'analyse : {analysis_level}")

    try:
        client, model = get_openai_client(payload_model)
        print(f"[INFO] Modèle GPT utilisé : {model}")
    except RuntimeError as exc:
        print(f"[ERREUR] {exc}", file=sys.stderr)
        return 1

    print("[INFO] Upload du PDF vers OpenAI...")
    uploaded_file = upload_pdf_file(client, pdf_path)
    if not uploaded_file:
        print("[ERREUR] Impossible d'uploader le fichier PDF.", file=sys.stderr)
        return 1

    print("[INFO] Récupération du schéma de référence...")
    cv_schema = get_cv_schema()
    if not cv_schema:
        print("[ERREUR] Impossible de récupérer le schéma de référence.", file=sys.stderr)
        return 1

    system_prompt = os.environ.get("GPT_SYSTEM_PROMPT", DEFAULT_SYSTEM_PROMPT).strip()
    base_prompt = os.environ.get("GPT_BASE_PROMPT", DEFAULT_USER_PROMPT).strip()
    user_prompt = build_user_prompt(base_prompt, cv_schema)

    print("[INFO] Analyse du CV par ChatGPT...")
    try:
        output = call_chatgpt(client, model, system_prompt, user_prompt, uploaded_file)
    except Exception as exc:
        print(f"[ERREUR] Appel API échoué : {exc}", file=sys.stderr)
        return 1

    text_output = output.get("content", "").strip()
    if not text_output:
        print("[ERREUR] ChatGPT n'a pas pu extraire les informations du CV.", file=sys.stderr)
        print(f"[DEBUG] Réponse complète reçue : {output}", file=sys.stderr)
        return 1

    preview = text_output.strip().replace("\n", " ")
    if len(preview) > 200:
        preview = preview[:200] + "..."
    print(f"[DEBUG] Réponse brute de ChatGPT : {preview}", file=sys.stderr)

    try:
        formatted_text = normalize_json_payload(text_output)
    except ValueError as exc:
        print(f"[ERREUR] JSON invalide retourné par ChatGPT : {exc}", file=sys.stderr)
        print(f"[DEBUG] Contenu qui a causé l'erreur : {text_output}", file=sys.stderr)

        # Essayer de nettoyer le texte et extraire le JSON
        try:
            # Rechercher un bloc JSON dans la réponse
            import re
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', text_output, re.DOTALL)
            if json_match:
                json_content = json_match.group(1)
                print(f"[INFO] JSON extrait des balises markdown", file=sys.stderr)
                formatted_text = normalize_json_payload(json_content)
            else:
                # Essayer de trouver juste un objet JSON
                json_match = re.search(r'(\{.*\})', text_output, re.DOTALL)
                if json_match:
                    json_content = json_match.group(1)
                    print(f"[INFO] JSON extrait du texte brut", file=sys.stderr)
                    formatted_text = normalize_json_payload(json_content)
                else:
                    print("[ERREUR] Impossible d'extraire un JSON valide de la réponse", file=sys.stderr)
                    return 1
        except Exception as cleanup_exc:
            print(f"[ERREUR] Échec du nettoyage du JSON : {cleanup_exc}", file=sys.stderr)
            return 1

    target_dir = ensure_response_directory()
    base_name = derive_filename()
    output_path = save_output_file(formatted_text, target_dir, base_name)

    print(f"[INFO] CV importé avec succès : {output_path.name}")
    print(f"::result::{output_path.name}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
