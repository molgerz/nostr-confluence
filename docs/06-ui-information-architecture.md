# 06 — UI & Informationsarchitektur

## Layout (Confluence-Vorbild)

```
┌───────────────────────────────────────────────────────────────────┐
│ Logo  Spaces ▾  Suche…              [+ Erstellen]  Theme  Avatar│  Topbar 48px
├──────────────┬────────────────────────────────────┬───────────────┤
│ Space-Kopf   │ Breadcrumb: Handbuch / Onboarding  │ Auf dieser    │
│ Engineering  │                                    │ Seite         │
│ öffentlich   │ # Onboarding                       │  · Ziel       │
│              │                                    │  · Zugänge    │
│ Übersicht    │ Zuletzt geändert von carol · 11:40 │  · Kontakt    │
│ Alle Seiten  │ [Bearbeiten][Historie][Teilen]     │               │
│ Mitglieder   │                                    │               │
│              │ Markdown-Inhalt …                  │               │
│ ▾ Handbuch   │                                    │               │
│   · Onboard. │                                    │               │
│   · Tooling  │                                    │               │
│ ▸ Prozesse   │                                    │               │
│              │                                    │               │
│ + Seite      │                                    │               │
└──────────────┴────────────────────────────────────┴───────────────┘
   240px                 flexibel, max 820px            220px
```

## Linke Leiste — Anforderung 2 im Detail

Vier Zonen, von oben:

1. **Space-Kopf** — Name und Bild aus `39000`, Badge `öffentlich`/`privat`,
   Space-Wechsler. Bei Nicht-Mitgliedschaft: Button "Beitreten".
2. **Fixe Einträge** — umgesetzt sind *Übersicht* und *Suche*. Die
   Mitgliederliste und die Moderation liegen auf der Übersichtsseite statt in
   der Leiste. **Offen:** eigene Einträge für "Alle Seiten", "Zuletzt geändert"
   und "Space-Einstellungen".
3. **Seitenbaum** — aufklappbar, aus `page-parent` projiziert
   ([02](02-data-model-events.md)). Aktive Seite hervorgehoben, Elternpfad
   automatisch geöffnet. Ungespeicherte Entwürfe erscheinen kursiv mit Punkt.
4. **Fußzeile** — "+ Seite erstellen", Relay-Statusanzeige (verbunden /
   AUTH nötig / offline) — wichtig, weil ohne Relay nichts publizierbar ist.

Verhalten: einklappbar auf 40px, Zustand in `localStorage`. Unter 768px
Breite verschwindet die Leiste ganz und wird über ein Menü in der Topbar als
Overlay eingeblendet; nach einem Sprung schliesst sie sich wieder.

Die rechte Leiste ("Auf dieser Seite") entsteht aus den Überschriften des
angezeigten Markdown-Textes und erscheint ab 1280px Breite, sobald es
mindestens zwei Überschriften gibt. Überschriften in Codeblöcken zählen nicht
mit — ein `# Kommentar` in einem Shell-Beispiel ist keine Überschrift.

## Topbar

Logo, Space-Wechsler, Suche, "+ Erstellen", **Theme-Umschalter
(System/Hell/Dunkel, [12](12-theming.md))**, Avatar mit npub-Menü
(Profil, Relay-Verbindung, Abmelden).

## Seiten-Zustände

| Zustand | Anzeige |
|---|---|
| Lesen | Markdown gerendert, TOC rechts, Byline, Aktionsleiste |
| Bearbeiten | Split (Markdown links, Vorschau rechts), Speichern/Abbrechen, Feld "Was hast du geändert?" → `summary` |
| Konflikt | Banner "Diese Seite wurde von <npub> geändert" + Merge-Dialog |
| Nicht eingeloggt | Aktionen deaktiviert, Hinweis "Mit Nostr anmelden zum Bearbeiten" |
| Kein Mitglied | Button "Beitreten und bearbeiten" (löst `9021` aus) |
| Publish fehlgeschlagen | Fehlermeldung im Editor mit dem **wörtlichen Relay-Grund**, eingeordnet nach Ursache (AUTH nötig, Rechte, sonstiges). Der Text bleibt im Editor stehen, es geht nichts verloren |

Der letzte Zustand ist Pflicht, nicht Kür: bei einem verteilten Speicher darf
"gespeichert" nie behauptet werden, bevor das Relay `OK true` geschickt hat.

**Anders gelöst als geplant:** Statt eines gelben Streifens "nur lokal
gespeichert" bleibt der Editor einfach offen und zeigt den Relay-Grund. Ein
Entwurf, der nur im Browser liegt, wäre ein zweiter Speicherort mit eigenen
Fragen (Wo? Wie lange? Was bei Account-Wechsel?) — dafür bräuchte es den noch
nicht gebauten lokalen Cache.

## Editor

- **Umgesetzt**: CodeMirror 6 mit Markdown-Hervorhebung und umschaltbarer
  Vorschau, Feld für die Änderungsnotiz, automatisch abgeleiteter Slug,
  Elternseite wählbar. Der Farbmodus wird über ein `Compartment`
  umkonfiguriert, damit Cursor und Undo-Historie beim Umschalten erhalten
  bleiben.
- **Geplant**: Toolbar für Überschriften/Listen/Links/Codeblock, Bild per
  Drag & Drop (braucht Blossom/NIP-96-Upload).
- **Später**: WYSIWYG (TipTap), das Markdown erzeugt. Bewusst nicht zuerst, weil
  WYSIWYG plus Merge-Konflikte gleichzeitig zu viel Risiko ist.

## Identitätsdarstellung

Überall, wo eine Person auftaucht: Avatar + Anzeigename + gekürzter npub
(`npub1qz…7k4f`, monospace, Klick kopiert vollständig). Anzeigenamen sind
frei wählbar und nicht eindeutig — der npub ist die Identität, und das UI
zeigt das konsequent, statt es zu verstecken.

## Routing

```
/                          Space-Auswahl
/login                     NIP-07-Anmeldung
/s/:group                  Space-Übersicht (Metadaten, Mitglieder, Seitenliste)
/s/:group/new              Seite anlegen  (?parent=<slug> für eine Unterseite)
/s/:group/search           Suche          (?q=…)
/s/:group/:slug            Seite lesen
/s/:group/:slug/edit       Bearbeiten     (?merge=1 zum Zusammenführen)
/s/:group/:slug/history    Historie mit Vergleich
/s/:group/:slug/blame      Zeilenherkunft
```

`groupId` inklusive Relay-Host (URL-kodiert), damit ein Link vollständig ist:
`/s/relay.example.com'engineering/onboarding`.
