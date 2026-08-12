# Schichtwerk unter Windows installieren

Diese Anleitung erklärt Schritt für Schritt, wie Sie das Dienstplan-Programm **Schichtwerk** auf einem Windows-PC einrichten.  
Sie brauchen **keine Programmierkenntnisse** – folgen Sie einfach der Reihe nach den Punkten.

Geschätzte Dauer beim ersten Mal: etwa 15–25 Minuten.

---

## Was Sie brauchen

- einen Windows-PC (Windows 10 oder 11)
- Internetzugang
- ca. 500 MB freien Speicherplatz
- die Erlaubnis, Programme zu installieren (bei Firmen-PCs ggf. die IT fragen)

---

## Überblick (Kurzfassung)

1. Programm **Node.js** installieren  
2. Projektordner herunterladen  
3. Zwei Dateien einmalig vorbereiten  
4. Installation starten  
5. Programm im Browser öffnen  

Danach starten Sie Schichtwerk später immer mit einem Doppelklick auf `starten.bat`.

---

## Schritt 1: Node.js installieren

Node.js ist die „Laufzeitumgebung“, mit der Schichtwerk auf Ihrem PC läuft. Sie müssen es nur **einmal** installieren.

1. Öffnen Sie im Browser diese Seite:  
   **https://nodejs.org/**
2. Laden Sie die Version mit dem Hinweis **LTS** herunter  
   (große grüne Schaltfläche, z. B. „Recommended For Most Users“).
3. Öffnen Sie die heruntergeladene Datei (z. B. `node-vXX.x.x-x64.msi`).
4. Klicken Sie sich durch den Installer:
   - **Next** / Weiter
   - Lizenz akzeptieren
   - alles bei den Standard-Einstellungen belassen
   - **Install** / Installieren
5. Wenn Windows nachfragt, die Installation erlauben: **Ja**.
6. Am Ende auf **Finish** / Fertig stellen klicken.

### Prüfen, ob es geklappt hat

1. Drücken Sie die Windows-Taste.
2. Tippen Sie: `Eingabeaufforderung` (oder `cmd`).
3. Öffnen Sie die **Eingabeaufforderung**.
4. Tippen Sie genau Folgendes und drücken Sie Enter:

```text
node -v
```

5. Tippen Sie danach:

```text
npm -v
```

Wenn jeweils eine Versionsnummer erscheint (z. B. `v22.14.0` und `10.9.2`), ist alles in Ordnung.  
Falls „nicht erkannt“ erscheint: PC neu starten und erneut prüfen. Node.js ggf. noch einmal installieren.

---

## Schritt 2: Projekt herunterladen

### Variante A – ZIP-Datei (einfachste Variante)

1. Öffnen Sie die Projektseite auf GitHub:  
   **https://github.com/xXLaser/Schichtplaner**
2. Klicken Sie auf den grünen Button **Code**.
3. Wählen Sie **Download ZIP**.
4. Entpacken Sie die ZIP-Datei (Rechtsklick → **Alle extrahieren…**).
5. Speichern Sie den Ordner z. B. hier:

```text
C:\Schichtwerk
```

Wichtig: Der Pfad sollte **keine** Umlaute und möglichst **keine Leerzeichen** enthalten.

### Variante B – Mit Git (nur wenn Sie Git schon kennen)

```text
git clone https://github.com/xXLaser/Schichtplaner.git C:\Schichtwerk
cd C:\Schichtwerk
```

---

## Schritt 3: Einstellungsdatei anlegen

1. Öffnen Sie den Ordner `C:\Schichtwerk` im Explorer.
2. Suchen Sie die Datei **`.env.example`**.
3. Kopieren Sie diese Datei (Rechtsklick → Kopieren, dann Einfügen).
4. Benennen Sie die Kopie um in:

```text
.env
```

Hinweis: Wenn Windows die Endung nicht anzeigt:
- Im Explorer oben auf **Ansicht** gehen
- Haken setzen bei **Dateinamenerweiterungen**

Der Inhalt der Datei `.env` sollte so aussehen:

```text
DATABASE_URL="file:./dev.db"
```

Das ist die Verbindung zur lokalen Datenbank. Sie müssen daran nichts ändern.

---

## Schritt 4: Installation der Programmteile

1. Öffnen Sie den Ordner `C:\Schichtwerk`.
2. Klicken Sie in die Adresszeile des Explorers (dort, wo der Pfad steht).
3. Tippen Sie `cmd` und drücken Sie Enter.  
   Es öffnet sich ein schwarzes Fenster **im richtigen Ordner**.
4. Tippen Sie nacheinander diese Befehle. Nach jedem Befehl Enter drücken und warten, bis er fertig ist:

### 4.1 Abhängigkeiten laden

```text
npm install
```

Das kann einige Minuten dauern. Warte, bis wieder der blinkende Cursor erscheint und keine Fehlermeldung rot angezeigt wird.

### 4.2 Datenbank einrichten

```text
npx prisma migrate dev --name init
```

Falls gefragt wird, ob etwas angelegt werden soll: mit Enter bestätigen bzw. `y` tippen und Enter.

### 4.3 Beispieldaten laden (empfohlen zum Ausprobieren)

```text
npm run db:seed
```

Damit werden Beispieldaten angelegt (Mitarbeiter, Kompetenzen, Schichten). Ideal zum Testen.

---

## Schritt 5: Programm starten

### Einfach: Doppelklick

Im Ordner `C:\Schichtwerk` liegt die Datei:

```text
starten.bat
```

Doppelt darauf klicken.

### Alternativ: per Befehl

In der Eingabeaufforderung im Projektordner:

```text
npm run dev
```

Lassen Sie das schwarze Fenster **offen**. Wenn Sie es schließen, stoppt das Programm.

Wenn alles klappt, erscheint sinngemäß:

```text
Ready on http://localhost:3000
```

---

## Schritt 6: Im Browser öffnen

1. Öffnen Sie Chrome, Edge oder Firefox.
2. Tippen Sie in die Adresszeile:

```text
http://localhost:3000
```

3. Enter drücken.

Sie sollten jetzt die Oberfläche von **Schichtwerk** sehen (Menü mit Dienstplan, Mitarbeiter, Kompetenzen usw.).

---

## So bedienen Sie das Programm (Kurzüberblick)

1. **Kompetenzen** – Fähigkeiten anlegen (z. B. Schichtleitung, Maschinenführung)  
2. **Mitarbeiter** – Personen anlegen und Kompetenzen zuweisen  
3. **Schichten** – Früh/Spät/Nacht festlegen und eintragen, **wie viele** je Kompetenz nötig sind  
4. **Abwesenheiten** – Urlaub und Krankenstand eintragen (der Plan wird dabei neu berechnet)  
5. **Dienstplan** – Woche auswählen und bei Bedarf **Plan neu generieren**

Tipp: Mit den Beispieldaten können Sie sofort im **Dienstplan** auf „Plan neu generieren“ klicken.

---

## Programm beenden

- Das schwarze Fenster (Eingabeaufforderung) schließen  
  **oder** dort `Strg + C` drücken und mit `J`/`Y` bestätigen.

---

## Beim nächsten Mal starten (nach der Ersteinrichtung)

1. Doppelklick auf `starten.bat`  
2. Browser öffnen: **http://localhost:3000**

Die Installation (`npm install` usw.) müssen Sie **nicht** jedes Mal wiederholen.

---

## Häufige Probleme und Lösungen

### „node ist nicht erkannt“ / „npm ist nicht erkannt“
- Node.js neu installieren (Schritt 1)
- PC neu starten
- Danach `node -v` erneut prüfen

### Seite im Browser lädt nicht
- Prüfen, ob das schwarze Fenster noch offen ist und `npm run dev` läuft
- Adresse genau so eingeben: `http://localhost:3000`
- Firewall-Hinweis von Windows ggf. erlauben

### Fehler bei `npm install`
- Internetverbindung prüfen
- Als Administrator versuchen (Rechtsklick auf Eingabeaufforderung → „Als Administrator ausführen“)
- Antivirus kurz prüfen, ob er den Ordner blockiert

### Port 3000 schon belegt
Ein anderes Programm nutzt bereits Port 3000. Dann starten mit:

```text
npm run dev -- --port 3001
```

Und im Browser öffnen: `http://localhost:3001`

### Alles zurücksetzen (Beispieldaten neu)
Nur wenn Sie die Datenbank komplett neu aufsetzen wollen:

```text
npm run db:reset
```

Achtung: Dadurch werden bestehende Einträge gelöscht und die Beispieldaten neu geladen.

---

## Für die IT / Fortgeschrittene (kurz)

| Thema | Hinweis |
| --- | --- |
| Technik | Next.js, Prisma, SQLite |
| Datenbankdatei | liegt lokal unter `prisma/dev.db` |
| Netzwerk | Standard nur auf dem eigenen PC (`localhost`) |
| Mehrere Nutzer | aktuell für Einzelplatz gedacht; für Team-Betrieb wäre ein Server/Hosting nötig |
| Updates | neuen Stand von GitHub holen, dann `npm install` und ggf. `npx prisma migrate dev` |

---

## Hilfe holen

Wenn etwas hängen bleibt, notieren Sie bitte:

1. den genauen Schritt (z. B. „bei npm install“)
2. den kompletten Fehlertext aus dem schwarzen Fenster
3. die Ausgabe von `node -v` und `npm -v`

Damit lässt sich das Problem meist schnell finden.
