# 👷 Thekedar Dashboard — Labor & Wage Manager

A simple, offline-first app for a **thekedar (contractor)** to keep the daily
record of **mistri / mazdoor / helpers**, their **daily wage (dihari)**, any
**advance / kharcha** given during the week, and an automatic **weekly salary
settlement** — with **voice (speech-to-text) entry** so data can be added just
by speaking.

بولے، لکھے، اور ہفتے کے آخر میں ہر مزدور کا حساب خودبخود بن جائے۔

---

## ✨ Features

| Feature | Urdu |
| --- | --- |
| Add workers with role + daily wage | مزدور کی دیہاڑی کے ساتھ اندراج |
| Mark daily attendance (full / half / overtime / double / absent) | روزانہ حاضری |
| Record advances / kharcha given during the week | ہفتے میں دی گئی پیشگی |
| Auto weekly settlement: **wages earned − advances = net payable** | ہفتہ وار حساب |
| **Speech-to-text** entry (Urdu / Hindi / English) | آواز سے اندراج |
| Print / Save weekly sheet as PDF | ہفتہ وار پرچی پرنٹ |
| Works **offline**, no login, data stays on your device | آف لائن |

## 🧮 How the weekly math works

For the selected week (Mon–Sun), for each worker:

```
Days worked   = Σ attendance   (full=1, half=0.5, overtime=1.5, double=2, absent=0)
Earned        = Days worked × Daily wage
Advances      = Σ advances given during the week
Net Payable   = Earned − Advances
```

At the end of the week the app shows exactly what to hand over to each worker
after adjusting the advances they already took.

## 🎤 Voice entry

Two ways to use speech:

1. **Field mic (🎤)** next to a box — tap and speak just that value
   (name, wage, advance, note). Spoken numbers like *“panch so”* / *«پانچ سو»*
   are converted to `500`.
2. **Voice Quick Entry** on the Daily tab — say a full sentence like
   *“Aslam full day advance 500”* or *«اسلم آدھا دن پیشگی پانچ سو»* and the app
   fills the worker, attendance and advance for you to review and save.

Pick the language from the 🎙️ selector in the header (اردو / English / हिन्दी).

> Speech-to-text uses the browser's built-in Web Speech API. It works best in
> **Google Chrome / Microsoft Edge**. If your browser doesn't support it, the
> mic buttons hide automatically and you can still type everything.

## 🚀 Run / Host it

It's a static site — no build step, no server.

- **Locally:** open `index.html`, or run `python3 -m http.server` and visit
  `http://localhost:8000`.
- **GitHub Pages:** enable Pages on this repo (branch → `/root`). Done.

## 💾 Your data

Everything is stored in your browser's `localStorage` on the device — private
to you, available offline. Clearing browser data will erase it, so use
**Print / Save PDF** each week to keep a copy.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the design and how to optionally
sync to Google Sheets later.
