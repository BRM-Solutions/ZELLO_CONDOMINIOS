#!/usr/bin/env bash
# Uso: scripts/new-migration.sh <nome_em_snake_case>
# Cria supabase/migrations/<timestamp UTC>_<nome>.sql a partir de docs/templates/migration-template.sql (se existir).
set -euo pipefail

name="${1:-}"
if [[ ! "$name" =~ ^[a-z][a-z0-9_]*$ ]]; then
  echo "Uso: $0 <nome_em_snake_case>" >&2
  exit 1
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dir="$root/supabase/migrations"
template="$root/docs/templates/migration-template.sql"
file="$dir/$(date -u +%Y%m%d%H%M%S)_${name}.sql"

mkdir -p "$dir"
if [ -e "$file" ]; then
  echo "Ja existe: $file" >&2
  exit 1
fi

if [ -f "$template" ]; then
  cp "$template" "$file"
else
  printf -- "-- Migration: %s (forward-only; nunca editar depois de aplicada)\nset lock_timeout = '5s';\n\n" "$name" > "$file"
fi

echo "$file"
