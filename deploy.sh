#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/punktlandung}"
BRANCH="${BRANCH:-main}"
APP_URL="${APP_URL:-https://punktlandung.app}"
GENERATED_TRACKED_FILES=(next-env.d.ts)

log() {
  printf '\n%s\n' "$1"
}

restore_generated_files() {
  git -C "$APP_DIR" restore --worktree -- "${GENERATED_TRACKED_FILES[@]}" 2>/dev/null || true
}

cd "$APP_DIR"

if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "Deployment abgebrochen: Das Produktions-Repository enthält lokale Änderungen."
  git status --short
  exit 1
fi

OLD_COMMIT="$(git rev-parse HEAD)"
log "Aktualisiere $BRANCH (aktuell ${OLD_COMMIT:0:7}) ..."
git fetch origin "$BRANCH"

if ! git merge-base --is-ancestor HEAD "origin/$BRANCH"; then
  echo "Deployment abgebrochen: HEAD kann nicht per Fast-forward auf origin/$BRANCH aktualisiert werden."
  exit 1
fi

git merge --ff-only "origin/$BRANCH"
NEW_COMMIT="$(git rev-parse HEAD)"
echo "Release: ${OLD_COMMIT:0:7} -> ${NEW_COMMIT:0:7}"

trap restore_generated_files EXIT

log "Installiere exakt den Lockfile-Stand ..."
npm ci --no-audit

log "Prüfe Typen und WebSocket-Schutz ..."
npm run typecheck
npm run test:ws-hardening

log "Erzeuge und verifiziere den Produktions-Build ..."
npm run build
npm run security:verify

# Next.js passt next-env.d.ts an den verwendeten Ausgabepfad an. Diese rein
# generierte Änderung darf das Produktions-Repository nicht verschmutzen.
restore_generated_files

if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "Deployment abgebrochen: Build oder Installation haben unerwartete Repository-Änderungen erzeugt."
  git status --short
  exit 1
fi

log "Lade beide PM2-Prozesse neu ..."
pm2 reload punktlandung --update-env
pm2 reload punktlandung-ws --update-env
pm2 save

log "Prüfe die öffentliche HTTPS-Auslieferung ..."
curl --fail --silent --show-error --location --max-time 20 "$APP_URL" >/dev/null

log "Deployment erfolgreich: ${NEW_COMMIT}"
pm2 status
