# Schichtwerk – Dienstplan für Schichtbetriebe

Web-App zum Erstellen von Dienstplänen mit:

- **Mitarbeiter & Kompetenzen** – jeder Person mehrere Fähigkeiten zuweisen
- **Schichtanforderungen** – einstellen, wie viele Personen je Kompetenz pro Schicht anwesend sein müssen
- **Urlaub & Krankenstand** – Abwesenheiten erfassen
- **Automatische Planung & Kompensation** – Plan generieren; Abwesende werden ausgeschlossen und durch passende Kollegen ersetzt

## Starten

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## Technik

- Next.js (App Router) + TypeScript
- Prisma + SQLite
- Tailwind CSS

## Ablauf

1. Kompetenzen anlegen (z. B. Schichtleitung, Maschinenführung)
2. Mitarbeiter mit Kompetenzen pflegen
3. Schichten und Mindestanzahlen je Kompetenz konfigurieren
4. Abwesenheiten eintragen
5. Im Dienstplan „Plan neu generieren“ – der Algorithmus belegt Schichten fair und meldet Kompetenzlücken
