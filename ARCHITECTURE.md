# Architecture Brief: Thekedar Dashboard

This project follows the same **serverless, backend-free static-app pattern**
documented in the reference expense-tracker architecture: a static page that
runs entirely in the browser, with no server to deploy or maintain.

## Core Architecture

```
Static SPA (open file / GitHub Pages)
        │
        ├── Store  (js/storage.js)  → browser localStorage   [data store]
        ├── Speech (js/speech.js)   → Web Speech API          [voice input]
        └── App    (js/app.js)      → UI wiring / calculations
```

The entire application is HTML + CSS + vanilla JS. No framework, no build step,
no bundler, no backend. It can be opened straight from disk or hosted on any
static host (GitHub Pages).

## Why no backend

Same reasoning as the reference architecture — a contractor on-site needs
something that:

- works **offline** (spotty signal at a construction site),
- needs **no login / no signup** to start,
- keeps data **private on the device**.

`localStorage` satisfies all three with zero infrastructure. This mirrors the
reference doc's use of `localStorage` for configuration; here it is also the
primary data store.

## Data Model

Stored under a single key `thekedar.dashboard.v1`:

```jsonc
{
  "workers": [
    { "id": "...", "name": "Aslam", "role": "Mistri", "wage": 1200, "phone": "", "active": true, "createdAt": 0 }
  ],
  "entries": [
    { "id": "...", "workerId": "...", "date": "2026-07-29", "attendance": 1, "advance": 500, "note": "chai-pani", "createdAt": 0 }
  ],
  "settings": { "speechLang": "ur-PK" }
}
```

`attendance` is a multiplier (full `1`, half `0.5`, overtime `1.5`, double `2`,
absent `0`) so wages, overtime and half-days all fall out of one number.

## Weekly Settlement (the core calculation)

For a Monday–Sunday range, entries are aggregated per worker:

```
days     = Σ attendance
earned   = days × wage
advances = Σ advance
net      = earned − advances     // what to actually pay this week
```

Implemented in `renderWeekly()` (`js/app.js`). Weeks are navigable
(prev / next / this week) and printable to PDF via `window.print()` with a
print-only stylesheet.

## Speech-to-Text Layer

`js/speech.js` wraps `window.SpeechRecognition` / `webkitSpeechRecognition`:

- `Speech.listen(lang)` → runs one recognition, resolves with the transcript.
- `Speech.wordsToNumber(text)` → converts spoken numbers to integers, covering
  English, Roman-Urdu, Urdu script and Hindi script, plus Arabic-Indic and
  Devanagari digit normalisation (e.g. *“panch so” / «پانچ سو» / ۵۰۰ → 500*).

Two UX modes: per-field mics for single values, and a sentence-level
**Voice Quick Entry** parser that extracts worker + attendance + advance from a
spoken phrase.

### Gotchas (same spirit as the reference doc's "Common Pitfalls")

- Web Speech API is best-supported in **Chrome / Edge**; the UI degrades
  gracefully (mics hidden) when unsupported, so typing always works.
- Recognition needs **microphone permission** and (in most browsers) a
  **secure context** — `https://` or `localhost`/`file://`. GitHub Pages is
  HTTPS, so it works there.
- Spoken-number parsing is best-effort — the Quick Entry flow always asks the
  user to **review before saving**.

## Optional future step: Google Sheets sync

To match the reference architecture's Google-Sheets backend, a sync module
could be added without changing the UI:

1. Load `https://apis.google.com/js/api.js` and
   `https://accounts.google.com/gsi/client`.
2. Get an OAuth access token via Google Identity Services (tokens kept in
   memory, ~1h lifespan, silent re-request on load).
3. Mirror `workers` / `entries` to sheet tabs using
   `spreadsheets.values.append` / `update`, never deleting rows, only writing
   verified-empty ranges.
4. Store the OAuth Client ID + Spreadsheet ID in `settings`.

`Store` already isolates all persistence behind one interface, so a
`SheetsStore` adapter can be swapped in later with no UI rewrite.
