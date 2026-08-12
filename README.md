# Schichtwerk – Dienstplan für Schichtbetriebe

Web-App zum Erstellen von Dienstplänen mit:

- **Ursprungsdienstplan** – manuelle Basis; die Generierung startet immer davon
- **Dienstmodelle** – 4 Tage Dienst / 4 frei (Vollzeit), Mo–Fr 9–15 (Teilzeit), optional Zwischendienste
- **Überstundenpauschale** – einmal im Monat bis zu 5 Dienste in einer Woche (Vollzeit)
- **Ruhezeit 12 Stunden** – gesetzliche Pause zwischen Diensten (z. B. 11–23 → kein 6–18 am Folgetag)
- **Mitarbeiter & Kompetenzen** – jeder Person mehrere Fähigkeiten zuweisen
- **Schichtanforderungen** – einstellen, wie viele Personen je Kompetenz pro Schicht anwesend sein müssen
- **Schichtpräferenzen** – nur Tag, nur Nacht oder Wechseldienst je Mitarbeiter
- **Sollstunden** – Zielstunden pro Monat oder Quartal
- **Nachträgliches Anpassen** – Personen manuell hinzufügen/entfernen
- **Urlaubsplaner** – Kalender, Resturlaub, Anträge genehmigen
- **Mobile Nutzung** – Bottom-Navigation, Tag-Ansicht, Homescreen-App

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
