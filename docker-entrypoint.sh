#!/bin/sh
set -e

echo "=========================================="
echo " Schichtwerk Container wird vorbereitet"
echo "=========================================="
echo "DATABASE_URL: ${DATABASE_URL:-nicht gesetzt}"

# Datenordner sicherstellen (Volume kann leer/neu sein)
DB_DIR=$(dirname "$(echo "$DATABASE_URL" | sed -E 's#^file:##')")
mkdir -p "$DB_DIR" 2>/dev/null || true

echo "Wende Datenbank-Migrationen an ..."
npx prisma migrate deploy

EMPLOYEE_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.employee.count()
  .then((c) => { console.log(c); return prisma.\$disconnect(); })
  .catch(() => { console.log(0); });
" 2>/dev/null || echo 0)

if [ "$EMPLOYEE_COUNT" = "0" ]; then
  echo "Datenbank ist leer -> Beispieldaten werden geladen ..."
  npm run db:seed || echo "Hinweis: Seed fehlgeschlagen (nicht kritisch)."
else
  echo "Mitarbeiter in Datenbank: $EMPLOYEE_COUNT"
fi

echo "=========================================="
echo " Server startet auf Port 3000"
echo "=========================================="

exec "$@"
