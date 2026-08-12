# Schichtwerk – Dienstplan für Schichtbetriebe

Web-App zum Erstellen von Dienstplänen mit:

- **Mitarbeiter & Kompetenzen** – jeder Person mehrere Fähigkeiten zuweisen
- **Schichtanforderungen** – einstellen, wie viele Personen je Kompetenz pro Schicht anwesend sein müssen
- **Urlaubsplaner** – Kalender, Resturlaub, Anträge genehmigen, Überschneidungswarnungen
- **Krankenstand & Abwesenheiten** – erfassen und automatisch kompensieren
- **Mobile Nutzung** – Bottom-Navigation, Tag-Ansicht, als App auf dem Homescreen speicherbar

## Windows-Server – bitte zuerst lesen

Wenn die Start-Datei nach `node -v` / `npm -v` stehen bleibt: Sie haben sehr
wahrscheinlich den **falschen Ordner** (z. B. nur `server.js`).

**→ [`BITTE-LESEN.txt`](BITTE-LESEN.txt)**  
**→ [`ANLEITUNG-SERVER.txt`](ANLEITUNG-SERVER.txt)**

Schnellweg:

1. Branch-ZIP laden:  
   https://github.com/xXLaser/Schichtplaner/archive/refs/heads/cursor/schichtplaner-tool-94b2.zip
2. Nach `C:\Schichtwerk` entpacken (dort muss `package.json` direkt liegen)
3. `PRUEFEN.bat` → dann `starten-server-fenster-offen.bat`  
   oder einfach `INSTALLIEREN.bat`

## Installation unter Windows (PC)

**→ [INSTALLATION-WINDOWS.md](INSTALLATION-WINDOWS.md)**

## Starten (für Fortgeschrittene)

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run build
npm start
```

App: [http://localhost:3000](http://localhost:3000)  
Diagnose: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Technik

- Next.js (App Router) + TypeScript
- Prisma + SQLite
- Tailwind CSS
- PWA-Manifest für mobile Homescreen-Nutzung
