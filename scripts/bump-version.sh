#!/bin/bash
# scripts/bump-version.sh

COMMIT_MSG=$1
OLD_VERSION=$(node -p "require('./package.json').version")

# Découpage X.X.X.X
IFS='.' read -r V1 V2 V3 V4 <<< "$OLD_VERSION"

# Logique de décision
if [[ "$COMMIT_MSG" == *"feat!:"* || "$COMMIT_MSG" == *"BREAKING CHANGE:"* ]]; then
    NEW_VERSION="$((V1 + 1)).0.0.0"
elif [[ "$COMMIT_MSG" == *"feat:"* ]]; then
    NEW_VERSION="$V1.$((V2 + 1)).0.0"
elif [[ "$COMMIT_MSG" == *"fix:"* ]]; then
    NEW_VERSION="$V1.$V2.$((V3 + 1)).0"
else
    NEW_VERSION="$V1.$V2.$V3.$((V4 + 1))"
fi

echo "Passage de v$OLD_VERSION à v$NEW_VERSION (Motif: $COMMIT_MSG)"

# 1. Mise à jour Node
npm version "$NEW_VERSION" --no-git-tag-version

# 2. Scan dynamique et remplacement
EXCLUDE_DIRS=("--exclude-dir=.git" "--exclude-dir=node_modules" "--exclude-dir=.next" "--exclude-dir=dist" "--exclude-dir=_work")
FILES_TO_UPDATE=$(grep -rl "${EXCLUDE_DIRS[@]}" "$OLD_VERSION" .)

for FILE in $FILES_TO_UPDATE; do
    if [[ "$FILE" != *"package.json"* && "$FILE" != *"package-lock.json"* ]]; then
        echo "Updating: $FILE"
        sed -i "s/$OLD_VERSION/$NEW_VERSION/g" "$FILE"
    fi
done
