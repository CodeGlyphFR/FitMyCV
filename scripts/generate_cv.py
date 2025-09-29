#!/usr/bin/env python3
"""
Script de génération d'un nouveau CV via l'API ChatGPT.

Ce script reçoit les données du formulaire (liens et pièces jointes)
par la variable d'environnement GPT_GENERATOR_PAYLOAD, injectée
par la route Next.js /api/chatgpt/generate.

Prérequis :
  - python >= 3.9
  - pip install "openai>=1.12"
  - définir la variable d'environnement OPENAI_API_KEY
  - optionnel : OPENAI_MODEL (par défaut gpt-4.1-mini)
  - optionnel : GPT_SYSTEM_PROMPT / GPT_BASE_PROMPT pour personnaliser
    les messages envoyés à ChatGPT.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_SYSTEM_PROMPT = (
    "ROLE:\n"
    "Tu es un assistant spécialisé dans la rédaction de CV en français et tu connais tous les secrets du formatage ATS des outils RH pour le parsing de CV. "
    "Tu crées des contenus clairs, synthétiques et orientés vers la valeur.\n\n"
    "CONTEXT:\n"
    "J'ai besoin d'adapter un CV au format json donnée en CV de référence, à l'offre que tu auras reçu en pièce jointe (lien web, fichier PDF ou word). "
    "Ce CV adapté correspondra à l'offre d'emploi en pièce jointe et devra impérativement respecter la structure du CV de référence.\n\n"
)

DEFAULT_USER_PROMPT = (
    "TACHES:\n"
    "- Dans un premier temps, tu feras un résumé de l'offre d'emploi et tu listeras les hard skills, les tech skills et les softs skills indispensable pour l'offre.\n"
    "- A partir de ces éléments tu identifieras dans le CV de référence  les skills à conserver pour le CV final.\n"
    "  Si dans l'offre tu identifies une compétence manquante au CV de référence  mais qui peut etre justifié par les expériences du CV de référence , je t'autorise à les ajouter dans le CV final sans y ajouter de commentaires et d'évaluer le niveau à partir des expériences du CV de référence  dans le champ proficiency parmis la liste: Connaissances, Débutant, Intermédiaire, Confirmé, Avancé ou Expert).\n"
    "  Dans les compétences du CV, ne mélange pas les outils aux compétences technique.\n"
    "- Pour les champs education, languages et projects ne fait pas de modifications et reprend ceux du CV main.json sauf pour les tech_stack des projets où tu peux adapter suivant la description du projet et les soft skills de l'offre.\n"
    "- Pour le champ experience, je veux que tu adaptes les expérience CV de référence  à l'offre d'emploi en conservant une écriture orienté RH pour de la selection de CV. Tu ne dois pas modifier le titre du poste, ni mentir ou inventer sur les expériences.\n"
    "- Pour le champ current_title tu dois en générer un à partir du titre de poste de l'offre d'emploi tout en respectant le titre actuel du CV de référence , il doit y avoir une certaine logique.\n"
    "- Et enfin, rédige la description du champ summary du CV final avec un texte impactant pour taper dans l'oeil du recruteur. Tu ne dois pas inventer et te baser sur l'expérience du CV final. Ici la subtilité c'est de montrer au recruteur que avec l'expérience et les skills du CV final, le CV final peut répondre à l'offre et apporter beaucoup.\n"
    "- Si plusieurs adaptations semblent possibles, compare-les et ne conserve que la version la plus pertinente pour l'offre afin de renvoyer un unique CV final.\n"
    "  Réponds en texte uniquement le JSON final qui doit impérativement respecter la structure du CV de référence .\n\n"
)


def load_payload() -> Dict[str, Any]:
    payload_json = os.environ.get("GPT_GENERATOR_PAYLOAD")
    if not payload_json:
        raise ValueError("Variable d'environnement GPT_GENERATOR_PAYLOAD manquante.")
    try:
        payload = json.loads(payload_json)
    except json.JSONDecodeError as exc:
        raise ValueError("Payload GPT_GENERATOR_PAYLOAD invalide.") from exc
    return payload


def get_openai_client():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY est manquant.")

    try:
        from openai import OpenAI
    except ImportError as exc:  # noqa: F401
        raise RuntimeError(
            "Le script nécessite la version 1.0+ du SDK openai. Consultez la documentation et installez `pip install --upgrade openai`."
        ) from exc

    client = OpenAI(api_key=api_key)
    model = (
        os.environ.get("GPT_OPENAI_MODEL")
        or os.environ.get("OPENAI_MODEL")
        or os.environ.get("OPENAI_API_MODEL")
        or "gpt-4.1-mini"
    )
    return client, model


def convert_word_to_pdf(path: Path) -> Tuple[Optional[Path], List[Path]]:
    try:
        from docx2pdf import convert as docx2pdf_convert
    except ImportError:
        print("[AVERTISSEMENT] docx2pdf n'est pas installé, upload du fichier Word original.", file=sys.stderr)
        return None, []

    tmp_dir = Path(tempfile.mkdtemp())
    target = tmp_dir / f"{path.stem}.pdf"
    try:
        docx2pdf_convert(str(path), str(target))
    except Exception as exc:  # noqa: BLE001
        print(f"[AVERTISSEMENT] Conversion PDF impossible pour {path}: {exc}", file=sys.stderr)
        return None, [tmp_dir]

    if not target.exists():
        print(f"[AVERTISSEMENT] Conversion PDF non produite pour {path}", file=sys.stderr)
        return None, [tmp_dir]

    return target, [tmp_dir]


def cleanup_temp_paths(paths: List[Path]) -> None:
    for temp in paths:
        try:
            if temp.is_dir():
                shutil.rmtree(temp, ignore_errors=True)
            else:
                temp.unlink(missing_ok=True)
        except Exception:
            pass
def upload_file_for_responses(
    client,
    path: Path,
    alias: Optional[str] = None,
    source_path: Optional[Path] = None,
) -> Tuple[Optional[Dict[str, Any]], List[Path]]:
    temp_paths: List[Path] = []
    try:
        target_path = path
        suffix = path.suffix.lower()

        if suffix in {".doc", ".docx"}:
            converted, extra_paths = convert_word_to_pdf(path)
            temp_paths.extend(extra_paths)
            if not converted or not converted.exists():
                print(
                    f"[ERREUR] Conversion PDF requise pour {path.name}. Installez docx2pdf ou fournissez un PDF.",
                    file=sys.stderr,
                )
                return None, temp_paths
            target_path = converted

        with target_path.open("rb") as handle:
            remote = client.files.create(file=handle, purpose="assistants")

        return {
            "id": remote.id,
            "name": alias or path.name,
            "source_path": str(source_path or path),
        }, temp_paths
    except Exception as exc:  # noqa: BLE001
        print(f"[ERREUR] Impossible d'uploader {path}: {exc}", file=sys.stderr)
        return None, temp_paths


def prepare_attachments(
    client,
    main_cv_path: Optional[Path],
    files: List[Dict[str, Any]],
    reference_label: str,
) -> Tuple[Optional[str], Dict[str, Any], List[Dict[str, Any]], List[Path]]:
    temp_paths: List[Path] = []
    main_json_content: Optional[str] = None
    main_prompt: Dict[str, Any] = {}
    extra_remotes: List[Dict[str, Any]] = []

    if main_cv_path and main_cv_path.exists():
        try:
            main_json_content = main_cv_path.read_text(encoding="utf-8")
        except Exception as exc:  # noqa: BLE001
            print(f"[ERREUR] Lecture impossible de {reference_label} : {exc}", file=sys.stderr)
            cleanup_temp_paths(temp_paths)
            return None, {}, [], temp_paths

        main_prompt = {
            "name": f"{reference_label} (contenu intégré)",
            "description": "CV de référence complet utilisé pour l'adaptation",
        }
    else:
        print(f"[ERREUR] {reference_label} est requis mais introuvable.", file=sys.stderr)

    for entry in files:
        path_value = entry.get("path")
        if not path_value:
            continue
        file_path = Path(path_value)
        if not file_path.exists():
            print(f"[AVERTISSEMENT] Fichier introuvable {file_path}", file=sys.stderr)
            continue
        print(f"[INFO] Traitement pièce jointe {file_path}", file=sys.stderr)
        remote, temps = upload_file_for_responses(
            client,
            file_path,
            alias=entry.get("name") or file_path.name,
            source_path=file_path,
        )
        temp_paths.extend(temps)
        if remote:
            print(f"[INFO] Pièce jointe uploadée: {remote.get('name')} ({remote.get('id')})", file=sys.stderr)
            extra_remotes.append(
                {
                    "remote": remote,
                    "prompt": {
                        "name": remote["name"],
                        "description": "Pièce jointe utilisateur",
                    },
                }
            )

    return main_json_content, main_prompt, extra_remotes, temp_paths


def build_user_prompt(
    base_prompt: str,
    links: List[str],
    files: Optional[List[Dict[str, Any]]],
    main_json_content: Optional[str],
) -> str:
    sections: List[str] = []
    base_text = (base_prompt or "").strip()
    if base_text:
        sections.append(base_text)

    if main_json_content:
        sections.append(
            "Contenu du CV de référence à adapter (respecter strictement la structure) :\n"
            f"{main_json_content.strip()}\n\n"
        )

    if links:
        link_lines = ["Liens à explorer :"] + [f"- {link}" for link in links]
        sections.append("\n".join(link_lines))

    if files:
        files = [entry for entry in files if entry]
    if files:
        file_lines = ["\nFichiers joints à la conversation :"]
        for entry in files:
            name = ""
            detail = "CV de référence" or ""
            suffix = f"{detail}" if detail else ""
            file_lines.append(f"- {name}{suffix}")
        sections.append("\n".join(file_lines))

    sections.append(
        "\n\nProduit retour attendu : Afficher le contenu (dans le prompt de réponse) du CV final (formatage JSON) qui respecte la structure du CV de référence"
        " sans texte additionnel."
    )

    return "\n".join(part for part in sections if part)


def call_chatgpt(
    client,
    model: str,
    system_prompt: str,
    user_prompt: str,
    attachments: List[Dict[str, Any]],
) -> Dict[str, Any]:
    user_content: List[Dict[str, Any]] = [{"type": "input_text", "text": user_prompt}]
    for attachment in attachments:
        user_content.append(
            {
                "type": "input_file",
                "file_id": attachment["id"],
            }
        )

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

    # response.output_text est disponible avec la version 1.12+ du SDK
    if hasattr(response, "output_text") and response.output_text:
        return {"type": "text", "content": str(response.output_text).strip()}

    files_from_response: List[Dict[str, Any]] = []
    text_chunks: List[str] = []

    for block in getattr(response, "output", []) or []:
        for item in getattr(block, "content", []) or []:
            item_type = getattr(item, "type", None)
            if item_type == "output_text":
                text_chunks.append(getattr(item, "text", ""))
            elif item_type == "file":
                file_ref = getattr(item, "file", None)
                if file_ref and getattr(file_ref, "id", None):
                    files_from_response.append(
                        {
                            "id": file_ref.id,
                            "name": getattr(file_ref, "name", "gpt-output.json"),
                        }
                    )

    if files_from_response:
        return {"type": "files", "files": files_from_response}

    if text_chunks:
        result = "\n\n".join(chunk.strip() for chunk in text_chunks if chunk)
        if result:
            return {"type": "text", "content": result}

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


def derive_base_name(index: int) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    if index == 0:
        return timestamp
    return f"{timestamp}-{index+1}"


def save_output_file(content: str, target_dir: Path, base_name: str) -> Path:
    output_path = target_dir / f"{base_name}.json"
    backup_counter = 1
    while output_path.exists():
        output_path = target_dir / f"{base_name}_{backup_counter}.json"
        backup_counter += 1
    output_path.write_text(content, encoding="utf-8")
    return output_path


def fetch_openai_file(client, file_id: str) -> str:
    file_content = client.files.content(file_id)
    if hasattr(file_content, "read"):
        data = file_content.read()
    else:
        data = getattr(file_content, "text", None)
        if data is None:
            data = getattr(file_content, "body", b"")

    if isinstance(data, bytes):
        return data.decode("utf-8")
    return str(data)


def normalize_json_payload(raw: str) -> str:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON invalide retourné par ChatGPT: {exc}") from exc
    return json.dumps(data, indent=2, ensure_ascii=False)


def main() -> int:
    try:
        payload = load_payload()
    except Exception as exc:  # noqa: BLE001
        print(f"[ERREUR] Chargement du payload impossible : {exc}", file=sys.stderr)
        return 1

    links = payload.get("links") or []
    files: List[Dict[str, Any]] = list(payload.get("files") or [])
    raw_reference_file = payload.get("base_file") or "main.json"
    if not isinstance(raw_reference_file, str):
        raw_reference_file = "main.json"
    reference_file = (raw_reference_file.strip() or "main.json")
    reference_file = Path(reference_file).name

    system_prompt = os.environ.get("GPT_SYSTEM_PROMPT", DEFAULT_SYSTEM_PROMPT).strip()
    base_prompt = os.environ.get("GPT_BASE_PROMPT", DEFAULT_USER_PROMPT).strip()

    project_root = Path(__file__).resolve().parent.parent
    user_cv_dir = os.environ.get("GPT_USER_CV_DIR")
    if user_cv_dir:
        main_cv_path = Path(user_cv_dir) / reference_file
    else:
        main_cv_path = project_root / "data" / "cvs" / reference_file
    main_exists = False
    try:
        main_exists = main_cv_path.is_file()
        if not main_exists and reference_file == "main.json":
            try:
                minimal = {
                    "schema_version": "1.0.0",
                    "header": {
                        "full_name": os.environ.get("GPT_USER_NAME", ""),
                    },
                }
                main_cv_path.parent.mkdir(parents=True, exist_ok=True)
                main_cv_path.write_text(json.dumps(minimal, indent=2, ensure_ascii=False), encoding="utf-8")
                main_exists = True
            except Exception as write_exc:  # noqa: BLE001
                print(
                    f"[AVERTISSEMENT] {reference_file} introuvable et impossible de le créer : {write_exc}",
                    file=sys.stderr,
                )
    except OSError as exc:  # noqa: BLE001
        print(f"[AVERTISSEMENT] Accès impossible à {reference_file} : {exc}", file=sys.stderr)
        main_exists = False

    try:
        client, model = get_openai_client()
    except RuntimeError as exc:
        print(f"[ERREUR] {exc}", file=sys.stderr)
        return 1

    main_json_content, main_prompt, extra_remotes, temp_paths = prepare_attachments(
        client,
        main_cv_path if main_exists else None,
        files,
        reference_file,
    )

    if not main_json_content:
        cleanup_temp_paths(temp_paths)
        print("[ERREUR] Contenu du CV de référence indisponible, arrêt.", file=sys.stderr)
        return 1

    target_dir = ensure_response_directory()
    generated_files: List[str] = []

    runs: List[Dict[str, Any]] = []
    for link in links:
        runs.append({
            "links": [link],
            "attachments": [],
            "prompt_files": [main_prompt] if main_prompt else [],
            "label": link,
        })
    if not links and not extra_remotes:
        runs.append({
            "links": [],
            "attachments": [],
            "prompt_files": [main_prompt] if main_prompt else [],
            "label": reference_file,
        })

    for extra in extra_remotes:
        runs.append({
            "links": [],
            "attachments": [extra["remote"]],
            "prompt_files": ([main_prompt] if main_prompt else []) + [extra["prompt"]],
            "label": extra["remote"].get("name"),
        })

    for index, run in enumerate(runs):
        current_links = run["links"]
        user_prompt = build_user_prompt(
            base_prompt,
            current_links,
            run["prompt_files"],
            main_json_content,
        )

        #print("===== PROMPT ENVOYÉ À CHATGPT =====", file=sys.stderr)
        #print("--- SYSTEM PROMPT ---", file=sys.stderr)
        #print(system_prompt, file=sys.stderr)
        #print("--- USER PROMPT ---", file=sys.stderr)
        #print(user_prompt, file=sys.stderr)
        #print("===== FIN DU PROMPT =====", file=sys.stderr)
        print("\n=== Réponse de ChatGPT ===", file=sys.stdout)

        try:
            output = call_chatgpt(
                client,
                model,
                system_prompt,
                user_prompt,
                run["attachments"],
            )
        except Exception as exc:  # noqa: BLE001
            print(f"[ERREUR] Appel API échoué : {exc}", file=sys.stderr)
            cleanup_temp_paths(temp_paths)
            return 1

        base_name = derive_base_name(index)

        text_output = output.get("content", "").strip()
        if not text_output:
            print("[ERREUR] GPT n'a pas su générer le CV final.", file=sys.stderr)
            cleanup_temp_paths(temp_paths)
            return 1

        try:
            formatted_text = normalize_json_payload(text_output)
        except ValueError as exc:
            print(f"[ERREUR] JSON invalide retourné par ChatGPT : {exc}", file=sys.stderr)
            cleanup_temp_paths(temp_paths)
            return 1

        output_path = save_output_file(formatted_text, target_dir, base_name)
        generated_files.append(output_path.name)
        print(f"::result::{output_path.name}")

    cleanup_temp_paths(temp_paths)

    return 0 if generated_files else 1


if __name__ == "__main__":
    sys.exit(main())
