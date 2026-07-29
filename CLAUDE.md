# Working conventions for this repo

## One PR per request

Treat **every new request as its own unit of work**:

1. Start each new request from the latest `main`:
   `git fetch origin main && git checkout -B claude/<short-feature-slug> origin/main`
2. Do the work, commit with a clear message.
3. Push the branch and **open a separate pull request into `main`** for that
   request — do **not** stack unrelated requests onto an existing open PR.
4. Use a descriptive, kebab-case branch name per request
   (e.g. `claude/weekly-pdf-export`, `claude/urdu-numbers-fix`).

Keep each PR focused on the single request that created it, so it can be
reviewed and merged on its own.

## Project overview

Static, offline-first SPA (no backend) for a contractor (thekedar) to manage
labor (mistri/mazdoor), daily wages, advances, and weekly settlement, with
speech-to-text entry. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for design and
[`README.md`](./README.md) for usage. No build step — plain HTML/CSS/vanilla JS.
