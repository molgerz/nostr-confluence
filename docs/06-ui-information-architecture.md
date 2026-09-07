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
2. **Fixe Einträge** — Übersicht, Alle Seiten, Zuletzt geändert, Mitglieder
   (`39002`), Space-Einstellungen (nur wenn in `39001`).
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
| Nur lokal (Publish fehlgeschlagen) | Gelber Streifen "Nicht auf dem Relay gespeichert — erneut versuchen" |

Der letzte Zustand ist Pflicht, nicht Kür: bei einem verteilten Speicher darf
"gespeichert" nie behauptet werden, bevor das Relay `OK true` geschickt hat.

## Editor

- **Umgesetzt (Phase 3)**: Textfeld mit umschaltbarer Vorschau, Feld für die
  Änderungsnotiz, automatisch abgeleiteter Slug, Elternseite wählbar.
- **Geplant**: Markdown-Quelltext (CodeMirror 6) mit Live-Vorschau, Toolbar für
  Überschriften/Listen/Links/Codeblock, Bild per Drag & Drop (Phase 6, braucht
  Blossom/NIP-96-Upload).
- **Später**: WYSIWYG (TipTap), das Markdown erzeugt. Bewusst nicht zuerst, weil
  WYSIWYG plus Merge-Konflikte gleichzeitig zu viel Risiko ist.

## Identitätsdarstellung

Überall, wo eine Person auftaucht: Avatar + Anzeigename + gekürzter npub
(`npub1qz…7k4f`, monospace, Klick kopiert vollständig). Anzeigenamen sind
frei wählbar und nicht eindeutig — der npub ist die Identität, und das UI
zeigt das konsequent, statt es zu verstecken.

## Routing

```
/                          Space-Auswahl (meine + zuletzt besuchte)
/s/:groupId                Space-Übersicht
/s/:groupId/:slug          Seite lesen
/s/:groupId/:slug/edit     Bearbeiten
/s/:groupId/:slug/history  Historie
/s/:groupId/:slug/history/:revA..:revB   Diff
/login                     NIP-07-Anmeldung
```

`groupId` inklusive Relay-Host (URL-kodiert), damit ein Link vollständig ist:
`/s/relay.example.com'engineering/onboarding`.
