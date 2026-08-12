# Schichtwerk – Dienstplan für Schichtbetriebe

Web-App zum Erstellen von Dienstplänen mit:

- **Mitarbeiter & Kompetenzen** – jeder Person mehrere Fähigkeiten zuweisen
- **Schichtanforderungen** – einstellen, wie viele Personen je Kompetenz pro Schicht anwesend sein müssen
- **Urlaubsplaner** – Kalender, Resturlaub, Anträge genehmigen, Überschneidungswarnungen
- **Krankenstand & Abwesenheiten** – erfassen und automatisch kompensieren
- **Mobile Nutzung** – Bottom-Navigation, Tag-Ansicht, als App auf dem Homescreen speicherbar

## Installation unter Windows (empfohlen)

Für eine **vollständige, leicht verständliche Anleitung** (auch ohne Technikkenntnisse):

**→ [INSTALLATION-WINDOWS.md](INSTALLATION-WINDOWS.md)**

Kurzfassung nach der Ersteinrichtung:

1. Doppelklick auf `starten.bat`
2. Browser öffnen: [http://localhost:3000](http://localhost:3000)

### Handy / Tablet

1. Dieselbe Adresse im Handy-Browser öffnen (im gleichen WLAN, wenn der PC als Server läuft – oder gehostet)
2. Optional: „Zum Home-Bildschirm“ / „Add to Home Screen“ – dann wie eine App

## Starten (für Fortgeschrittene)

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
- PWA-Manifest für mobile Homescreen-Nutzung

## Ablauf

1. Kompetenzen anlegen (z. B. Schichtleitung, Maschinenführung)
2. Mitarbeiter mit Kompetenzen und Urlaubskontingent pflegen
3. Schichten und Mindestanzahlen je Kompetenz konfigurieren
4. Urlaub im **Urlaubsplaner** eintragen / genehmigen
5. Krankenstände unter Abwesenheiten erfassen
6. Im Dienstplan „Plan neu generieren“ – Kompensation und Kompetenzlücken
