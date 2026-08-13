# Schichtwerk – Dienstplan für Schichtbetriebe

Lokales Planungsprogramm (optional als **eine EXE**) für:

- **Ersteinrichtung** – Admin-Konto, Kompetenzen, Schichten, Mitarbeiter und aktueller 2-Wochen-Plan
- **Betriebsmodell** – Tag 06:00–18:00, Nacht 18:00–06:00, Teamleiter 9 Stunden dazwischen (12:00–21:00), untertags immer Teilzeit
- **Nächste 2 Wochen** – immer von diesem Fenster aus weiterplanen, Urlaub und Krankenstand werden berücksichtigt
- **Feiertage** – österreichische (oder deutsche) Feiertage im Plan hervorgehoben
- **Export/Import** – Dienstplan als JSON oder CSV
- **Datenbank** – Onboard-SQLite oder externes MySQL; Webzugriff im LAN optional

Weitere Funktionen: Ursprungsdienstplan, 4/4-Rotation, 12-Stunden-Ruhezeit, Kompetenzen, Sollstunden, mobile Ansicht.

## Standalone-EXE (Windows)

```bash
npm install
npm run build:exe
```

Ergebnis: `release/Schichtwerk.exe`. Beim ersten Start: SQLite oder MySQL und ob die App nur lokal oder im Netz erreichbar sein soll. Danach öffnet sich der Setup-Assistent.

Die lokale Datenbank liegt unter `%LOCALAPPDATA%\schichtwerk-desktop\data\dev.db`.

## Windows-Server – Dauerbetrieb

**→ [`ANLEITUNG-SERVER.txt`](ANLEITUNG-SERVER.txt)** – vollständige Anleitung für beide Wege

Zwei Wege, jeweils mit automatischem Neustart bei Windows-Boot, ohne offenes Fenster:

| Weg | Wann nutzen | Start |
| --- | --- | --- |
| **Windows-Dienst** (empfohlen) | Kein Docker auf dem Server nötig | `PRUEFEN.bat`, dann `WINDOWS-DIENST-INSTALLIEREN.bat` (als Administrator) |
| **Docker** | Docker/WSL2 bereits vorhanden | `docker compose up -d --build` |

Danach testen: `http://SERVER-IP:3000/api/health`

Falls die Startdatei nach `node -v` stehen bleibt: sehr wahrscheinlich der **falsche Ordner** (z. B. nur `server.js` statt des vollständigen Projekts). Siehe `ANLEITUNG-SERVER.txt` → Schritt 0.

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

### Entwickeln & testen ohne Datenverlust

Die Datenbank wird **nicht** bei jedem Start überschrieben. Seed läuft nur, wenn die DB leer ist (0 Mitarbeiter).

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | App starten – Testdaten bleiben |
| `npm run db:backup` | Kopie nach `prisma/backups/` |
| `npm run db:restore` | Neuestes Backup zurückspielen |
| `npm run db:seed` | **Geschützt:** bricht ab, wenn schon Daten da sind |
| `npm run db:seed:force` | Beispieldaten erzwingen (löscht alles) |
| `npm run db:reset` | Schema neu + Seed (löscht alles) |

**Hinweis:** „Plan neu generieren“ löscht nur die **Zuweisungen** im gewählten Zeitraum – Mitarbeiter, Schichten und Abwesenheiten bleiben.

## Ablauf

1. Beim ersten Start Admin anlegen und optional das Betriebsmodell einspielen (Tag/Nacht/Teamleiter/Teilzeit)
2. Mitarbeiter mit Rolle erfassen: Schicht 12 Std., Teamleiter 9 Std. oder Teilzeit untertags
3. Aktuellen 2-Wochen-Plan eintragen – daraus werden Rotation und Präferenzen abgeleitet
4. Unter Dienstplan die nächsten 2 Wochen planen (Urlaub wird berücksichtigt)
5. Bei Bedarf exportieren/importieren oder nachträglich anpassen

## Technik

- Next.js (App Router) + TypeScript
- Prisma + SQLite (optional MySQL)
- Electron portable EXE
- Tailwind CSS
- PWA-Manifest für mobile Homescreen-Nutzung
