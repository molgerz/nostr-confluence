# 12 — Theming: Hell und Dunkel

**Anforderung:** Umschaltbar zwischen hellem und dunklem Modus.

## Entscheidung

Drei Zustände, nicht zwei: **System / Hell / Dunkel**. "System" ist der
Default, folgt `prefers-color-scheme`; die manuelle Wahl überschreibt und wird
in `localStorage` gehalten. Umschalter in der Topbar rechts neben dem Avatar.

Umsetzung: Attribut `data-theme="light|dark"` am `<html>`-Element, gesetzt von
JavaScript. Tailwind wird per `dark`-Variante an dieses Attribut gekoppelt
(nicht an die Media Query), sonst lässt sich der Modus nicht manuell erzwingen.
Zusätzlich `color-scheme: light dark`, damit Scrollbars, Auswahlfarbe und
Formular-Elemente vom Browser passend gerendert werden.

## Token-Ebenen

Komponenten benutzen **niemals** Rohfarben, nur semantische Tokens. Genau eine
Datei definiert beide Paletten:

| Token | Bedeutung |
|---|---|
| `--surface-0/1/2` | Seitenhintergrund, Sidebar/Karten, Vordergrundflächen |
| `--text-primary/secondary/muted` | Fließtext, Sekundärtext, Hinweise |
| `--border`, `--border-strong` | Trennlinien, Hover-Ränder |
| `--accent`, `--bg-accent`, `--text-accent` | Aktion, aktive Sidebar-Zeile, Buttons |
| `--danger`, `--warning`, `--success` (+ `bg-`/`text-`) | Konflikt-Banner, Publish-Fehler, "gespeichert" |
| `--diff-add-bg`, `--diff-del-bg`, `--diff-word-bg` | Diff-Ansicht |
| `--code-bg`, `--code-border` | Codeblöcke im Markdown |

Regel: Wenn eine Komponente eine Farbe braucht, die es als Token nicht gibt,
wird das Token ergänzt — nicht die Farbe inline geschrieben. Nur so bleibt der
zweite Modus überhaupt wartbar.

Im Dunkelmodus kein reines Schwarz als Fläche (zu harter Kontrast, Halation bei
Text) und kein reines Weiß als Text. Kontrast überall mindestens 4,5:1 für
Fließtext.

## Die vier Stellen, die dabei üblicherweise brechen

1. **Codeblöcke im Markdown** — Syntax-Highlighting braucht zwei Themes. Mit
   Shiki gehen Dual-Themes über CSS-Variablen in einem Rendering; mit
   highlight.js müssen zwei Stylesheets umgeschaltet werden. Vorschlag: Shiki,
   damit kein Stylesheet-Wechsel zur Laufzeit nötig ist.
2. **Der Editor** — CodeMirror 6 bringt sein eigenes Theme mit. Der Wechsel
   muss über ein `Compartment` mit `reconfigure` passieren, nicht durch
   Neuaufbau des Editors, sonst verliert man Cursor und Undo-Historie beim
   Umschalten.
3. **Die Diff-Ansicht** — Rot/Grün aus dem Hellmodus ist im Dunkelmodus
   entweder unlesbar oder schreit. Eigene, entsättigte Tokens für beide Modi,
   und Hinzufügen/Entfernen zusätzlich durch `+`/`−`-Marker kennzeichnen, nicht
   nur durch Farbe (Rot-Grün-Sehschwäche).
4. **Fremde Inhalte** — Avatare und eingebettete Bilder aus `kind 0` bzw. aus
   Seiten kommen mit beliebigem Hintergrund. Keine Transparenz-Annahmen; Bilder
   bekommen im Dunkelmodus einen neutralen Rahmen statt eines Filters.

## Kein Flackern beim Laden

Ein winziges, blockierendes Inline-Skript in `index.html` liest `localStorage`
und setzt `data-theme`, **bevor** das Bundle lädt. Ohne diesen Schritt sieht man
bei jedem Reload kurz den hellen Modus aufblitzen.

## Zeitpunkt

**Entscheidung:** Tokens und Umschalter kommen in **Phase 0**, nicht später.
Dunkelmodus nachzurüsten heißt, jede Komponente ein zweites Mal anzufassen; von
Anfang an mit Tokens zu arbeiten kostet fast nichts.

Prüfung: **offen.** Geplant sind Playwright-Screenshots der vier Kernansichten
(Seite lesen, Editor, Historie, Diff) in beiden Modi als Regressionstest.
Bisher wird von Hand im Browser geprüft.
