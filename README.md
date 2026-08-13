# Schichtwerk – Dienstplan für Schichtbetriebe

Lokales Dienstplan-Tool (optional mit Web-Zugriff) mit Setup-Assistent und portable EXE:

- **Standalone EXE** – `npm run build:exe` → `release/Schichtwerk.exe` (oder GitHub Action „Windows EXE bauen“)
- **Ersteinrichtung** – Admin, DB-Option, Kompetenzen, Firmen-Schichten, Mitarbeiter, 2-Wochen-Plan
- **Firmen-Schichten** – Tag 06–18, Nacht 18–06, Teamleiter 9h (09–18), Teilzeit untertags 09–15
- **Feiertage** – hervorgehoben (AT / DE / DE-BY)
- **Export/Import** – Dienstplan als JSON
- **Datenbank** – Onboard-SQLite oder externe MySQL (`npm run db:use-mysql`)
- **Web-Zugriff** – optional LAN; Standard nur localhost
- **Ursprungsdienstplan** – manuelle Basis; Generierung startet davon
- **Dienstmodelle** – 4/4 Vollzeit, Mo–Fr Teilzeit, Teamleiter-Zwischendienst
- **Ruhezeit 12 Stunden**, Urlaubsplaner, manuelle Nachbearbeitung

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

1. Kompetenzen und Schichten anlegen (inkl. Zwischendienste / Teilzeit 9–15)
2. Mitarbeiter anlegen: **Dienstmodell** (4/4 oder Mo–Fr), Präferenz, Sollstunden
3. Unter **Ursprungsplan** Basis manuell pflegen oder aus Modellen vorschlagen
4. Dienstplan generieren – übernimmt den Ursprung, füllt Lücken, beachtet Abwesenheiten und **12 Std. Ruhezeit**
5. Bei Bedarf nachträglich anpassen; unter „Stunden“ Soll/Ist prüfen

## Technik

- Next.js (App Router) + TypeScript
- Prisma + SQLite
- Tailwind CSS
- PWA-Manifest für mobile Homescreen-Nutzung
