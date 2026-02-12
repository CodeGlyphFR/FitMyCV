#!/bin/bash
set -e
# scripts/bump-version.sh — Versioning 4 parties (X.X.X.X)
# Scanne TOUS les commits depuis le dernier tag pour déterminer le niveau de bump.

OLD_VERSION=$(node -p "require('./package.json').version")

# Découpage X.X.X.X
IFS='.' read -r V1 V2 V3 V4 <<< "$OLD_VERSION"
V4=${V4:-0}

# Validation : chaque partie doit être un entier
for part in V1 V2 V3 V4; do
    val=${!part}
    if ! [[ "$val" =~ ^[0-9]+$ ]]; then
        echo "❌ Version invalide: $OLD_VERSION (partie $part='$val' n'est pas un entier)"
        exit 1
    fi
done

# Récupérer tous les messages de commits depuis le dernier tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
    ALL_MESSAGES=$(git log "$LAST_TAG"..HEAD --pretty=%B --no-merges)
else
    ALL_MESSAGES=$(git log --pretty=%B --no-merges -20)
fi

# Déterminer le plus haut niveau de changement (Major > Minor > Patch > Build)
BUMP="build"
while IFS= read -r line; do
    [ -z "$line" ] && continue
    if [[ "$line" == *"feat!:"* || "$line" == *"BREAKING CHANGE:"* ]]; then
        BUMP="major"
        break
    elif [[ "$line" == *"feat:"* ]]; then
        BUMP="minor"
    elif [[ "$line" == *"fix:"* && "$BUMP" != "minor" ]]; then
        BUMP="patch"
    fi
done <<< "$ALL_MESSAGES"

# Appliquer le bump
case $BUMP in
    major) NEW_VERSION="$((V1 + 1)).0.0.0" ;;
    minor) NEW_VERSION="$V1.$((V2 + 1)).0.0" ;;
    patch) NEW_VERSION="$V1.$V2.$((V3 + 1)).0" ;;
    build) NEW_VERSION="$V1.$V2.$V3.$((V4 + 1))" ;;
esac

echo "Passage de v$OLD_VERSION à v$NEW_VERSION (Bump: $BUMP)"
echo "  Commits analysés depuis ${LAST_TAG:-'(début)'}:"
echo "$ALL_MESSAGES" | grep -E '^(feat|fix|BREAKING)' | head -5 | while read -r msg; do echo "    - $msg"; done

# 1. Mise à jour package.json + package-lock.json (supporte les versions 4 parties)
node -e "
const fs = require('fs');
const v = '$NEW_VERSION';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = v;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
try {
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  lock.version = v;
  if (lock.packages && lock.packages['']) lock.packages[''].version = v;
  fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
} catch(e) {}
console.log('✅ package.json → v' + v);
"

# 2. Scan dynamique et remplacement dans les autres fichiers
EXCLUDE_DIRS=("--exclude-dir=.git" "--exclude-dir=node_modules" "--exclude-dir=.next" "--exclude-dir=dist" "--exclude-dir=_work")
FILES_TO_UPDATE=$(grep -rl "${EXCLUDE_DIRS[@]}" "$OLD_VERSION" . || true)

for FILE in $FILES_TO_UPDATE; do
    if [[ "$FILE" != *"package.json"* && "$FILE" != *"package-lock.json"* ]]; then
        echo "Updating: $FILE"
        sed -i "s/$OLD_VERSION/$NEW_VERSION/g" "$FILE"
    fi
done
