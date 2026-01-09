#!/bin/bash
#
# Script de test du pipeline CV v2
# Usage: ./scripts/test-pipeline-v2.sh [command] [options]
#
# Commands:
#   classify [preset]     - Test la phase de classification
#   experiences [preset]  - Test la phase batch_experience
#   skills [preset]       - Test la phase batch_skills
#   summary [preset]      - Test la phase batch_summary
#   full [preset]         - Test le pipeline complet
#   extraction <url>      - Test l'extraction d'une offre d'emploi
#   list-cvs              - Liste les CVs disponibles
#   list-presets          - Liste les presets disponibles
#
# Presets disponibles:
#   tech-ia       - CV Tech & Produit -> Expert LLM & Agentic AI
#   csm-architect - CV Customer Success -> Head of Customer Architect
#
# Exemples:
#   ./scripts/test-pipeline-v2.sh classify tech-ia
#   ./scripts/test-pipeline-v2.sh full csm-architect
#   ./scripts/test-pipeline-v2.sh extraction "https://indeed.com/job/xxx"
#

set -e

BASE_URL="http://localhost:3001"
API_URL="$BASE_URL/api/test/pipeline-v2"

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier que jq est installé
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required. Install with: sudo apt install jq${NC}"
    exit 1
fi

# Vérifier que le serveur est accessible
check_server() {
    if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
        echo -e "${RED}Error: Server not running on $BASE_URL${NC}"
        echo -e "${YELLOW}Start with: npm run dev${NC}"
        exit 1
    fi
}

# Fonction pour afficher l'aide
show_help() {
    head -30 "$0" | tail -28
}

# Test de classification
test_classify() {
    local preset="${1:-tech-ia}"
    echo -e "${BLUE}Testing Classification with preset: $preset${NC}"
    echo ""

    curl -s "$API_URL?preset=$preset&phase=classify" | jq '{
        jobOffer: {
            title: .jobOffer.title,
            company: .jobOffer.company,
            experience: .jobOffer.experience
        },
        sourceCv: {
            experienceCount: .sourceCv.experienceCount,
            education: [.sourceCv.education[]? | "\(.institution) - \(.field_of_study)"]
        },
        classification: (.phases[0].output // "No output")
    }'
}

# Test des expériences
test_experiences() {
    local preset="${1:-tech-ia}"
    echo -e "${BLUE}Testing Batch Experiences with preset: $preset${NC}"
    echo ""

    curl -s "$API_URL?preset=$preset" | jq '{
        sourceCv: {
            experiences: [.sourceCv.experiences[]? | {title, company}]
        },
        adaptedExperiences: [.phases[] | select(.type == "batch_experience") | {
            index: .input.experienceIndex,
            status: .status,
            output: .output
        }]
    }'
}

# Test des skills
test_skills() {
    local preset="${1:-tech-ia}"
    echo -e "${BLUE}Testing Batch Skills with preset: $preset${NC}"
    echo ""

    curl -s "$API_URL?preset=$preset" | jq '{
        sourceSkills: .sourceCv.skills,
        jobOfferSkills: .jobOffer.skills,
        adaptedSkills: (.phases[] | select(.type == "batch_skills") | {
            status: .status,
            output: .output,
            modifications: .modifications
        })
    }'
}

# Test du summary
test_summary() {
    local preset="${1:-tech-ia}"
    echo -e "${BLUE}Testing Batch Summary with preset: $preset${NC}"
    echo ""

    curl -s "$API_URL?preset=$preset" | jq '{
        sourceSummary: .sourceCv.summary,
        jobOffer: {
            title: .jobOffer.title,
            responsibilities: .jobOffer.responsibilities[0:3]
        },
        adaptedSummary: (.phases[] | select(.type == "batch_summary") | {
            status: .status,
            output: .output
        })
    }'
}

# Test complet
test_full() {
    local preset="${1:-tech-ia}"
    echo -e "${BLUE}Testing Full Pipeline with preset: $preset${NC}"
    echo ""

    curl -s "$API_URL?preset=$preset" | jq '{
        success: .success,
        duration: .duration,
        params: .params,
        jobOffer: {
            title: .jobOffer.title,
            company: .jobOffer.company,
            experience: .jobOffer.experience,
            skills_required: .jobOffer.skills.required[0:5]
        },
        phases: [.phases[] | {
            type: .type,
            status: .status,
            tokens: .tokens.total,
            durationMs: .durationMs
        }],
        generatedCv: {
            filename: .generatedCv.filename,
            headline: .generatedCv.summary.headline,
            experienceCount: (.generatedCv.experience | length),
            projectCount: (.generatedCv.projects | length)
        }
    }'
}

# Test extraction d'offre
test_extraction() {
    local url="$1"
    if [ -z "$url" ]; then
        echo -e "${RED}Error: URL required${NC}"
        echo "Usage: $0 extraction <url>"
        exit 1
    fi

    echo -e "${BLUE}Testing Job Offer Extraction${NC}"
    echo "URL: $url"
    echo ""

    # Encode URL
    local encoded_url=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$url', safe=''))")

    curl -s "$API_URL?jobOfferUrl=$url" | jq '.jobOffer'
}

# Liste des CVs
list_cvs() {
    echo -e "${BLUE}Available CVs in database:${NC}"
    echo ""

    node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cvs = await prisma.cvFile.findMany({
    select: { id: true, filename: true, content: true }
  });

  cvs.forEach(cv => {
    const content = typeof cv.content === 'string' ? JSON.parse(cv.content) : cv.content;
    console.log('ID:', cv.id);
    console.log('Title:', content?.header?.current_title || 'No title');
    console.log('Experiences:', content?.experience?.length || 0);
    console.log('---');
  });
}

main().catch(console.error).finally(() => prisma.\$disconnect());
"
}

# Liste des presets
list_presets() {
    echo -e "${BLUE}Available Test Presets:${NC}"
    echo ""
    echo -e "${GREEN}tech-ia${NC}"
    echo "  CV: Tech & Produit end-to-end | IA, SaaS, Électronique"
    echo "  Job: Expert LLM & Agentic AI @ AOSIS"
    echo ""
    echo -e "${GREEN}csm-architect${NC}"
    echo "  CV: Customer Success Manager"
    echo "  Job: Head of Customer Architect @ Inqom"
}

# Main
check_server

case "${1:-help}" in
    classify)
        test_classify "$2"
        ;;
    experiences)
        test_experiences "$2"
        ;;
    skills)
        test_skills "$2"
        ;;
    summary)
        test_summary "$2"
        ;;
    full)
        test_full "$2"
        ;;
    extraction)
        test_extraction "$2"
        ;;
    list-cvs)
        list_cvs
        ;;
    list-presets)
        list_presets
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
