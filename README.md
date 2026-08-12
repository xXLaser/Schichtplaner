# Schichtwerk – Dienstplan für Schichtbetriebe

Web-App zum Erstellen von Dienstplänen mit:

- **Mitarbeiter & Kompetenzen** – jeder Person mehrere Fähigkeiten zuweisen
- **Schichtanforderungen** – einstellen, wie viele Personen je Kompetenz pro Schicht anwesend sein müssen
- **Schichtpräferenzen** – nur Tag, nur Nacht oder Wechseldienst (z. B. 1 Woche Nacht/1 Woche Tag) je Mitarbeiter
- **Sollstunden** – Zielstunden pro Monat oder Quartal; der Planer gleicht automatisch aus, wer noch Stunden braucht
- **Nachträgliches Anpassen** – im Dienstplan Personen manuell hinzufügen/entfernen, auch nach der automatischen Generierung
- **Urlaubsplaner** – Kalender, Resturlaub, Anträge genehmigen, Überschneidungswarnungen
- **Krankenstand & Abwesenheiten** – erfassen und automatisch kompensieren
- **Mobile Nutzung** – Bottom-Navigation, Tag-Ansicht, als App auf dem Homescreen speicherbar

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

1. Kompetenzen anlegen
2. Mitarbeiter anlegen: Kompetenzen, Schichtpräferenz (Tag/Nacht/Wechseldienst) und optional Sollstunden pro Monat/Quartal hinterlegen
3. Schichten anlegen und je Schicht als Tag oder Nacht kennzeichnen
4. Dienstplan generieren – danach über „Nachträglich anpassen“ einzelne Personen ergänzen oder entfernen
5. Unter „Stunden“ den Soll-/Ist-Vergleich je Mitarbeiter einsehen

## Technik

- Next.js (App Router) + TypeScript
- Prisma + SQLite
- Tailwind CSS
- PWA-Manifest für mobile Homescreen-Nutzung
