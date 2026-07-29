/*
 * speech.js — Speech-to-text using the browser Web Speech API.
 *
 * Provides:
 *   Speech.isSupported()             -> boolean
 *   Speech.listen(lang, onResult)    -> starts one recognition, resolves with transcript
 *   Speech.wordsToNumber(text, lang) -> parse spoken numbers ("panch so" -> 500)
 *
 * No external library, no network call beyond the browser's built-in engine.
 */
const Speech = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function isSupported() {
    return !!SR;
  }

  let active = null;

  function listen(lang, { onStart, onEnd, onError } = {}) {
    return new Promise((resolve, reject) => {
      if (!SR) return reject(new Error("Speech recognition not supported"));
      if (active) {
        try { active.stop(); } catch (_) {}
      }
      const rec = new SR();
      active = rec;
      rec.lang = lang || "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;

      let got = false;
      rec.onstart = () => onStart && onStart();
      rec.onresult = (ev) => {
        got = true;
        const transcript = ev.results[0][0].transcript.trim();
        resolve(transcript);
      };
      rec.onerror = (ev) => {
        onError && onError(ev.error);
        reject(new Error(ev.error || "speech-error"));
      };
      rec.onend = () => {
        active = null;
        onEnd && onEnd();
        if (!got) resolve(""); // ended with nothing
      };
      rec.start();
    });
  }

  function stop() {
    if (active) {
      try { active.stop(); } catch (_) {}
      active = null;
    }
  }

  // ---- Spoken-number parsing (English / Roman-Urdu / Urdu / Hindi) ----
  const UNITS = {
    // english
    zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
    ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
    sixteen:16, seventeen:17, eighteen:18, nineteen:19, twenty:20, thirty:30,
    forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90,
    // roman urdu / hindi common
    sifar:0, ek:1, aik:1, ik:1, do:2, teen:3, char:4, chaar:4, panch:5, paanch:5,
    che:6, chay:6, chhe:6, saat:7, sath:7, aath:8, ath:8, nau:9, no:9, das:10,
    gyara:11, bara:12, tera:13, chauda:14, pandra:15, sola:16, satra:17,
    athara:18, unnees:19, bees:20, tees:30, chalis:40, chalees:40, pachas:50,
    pachaas:50, saath:60, sattar:70, assi:80, nabbe:90, navay:90,
    // urdu script
    "صفر":0, "ایک":1, "دو":2, "تین":3, "چار":4, "پانچ":5, "چھ":6, "چھے":6,
    "سات":7, "آٹھ":8, "نو":9, "دس":10, "بیس":20, "تیس":30, "چالیس":40,
    "پچاس":50, "ساٹھ":60, "ستر":70, "اسی":80, "نوے":90, "سو":100,
    "ہزار":1000,
    // hindi script
    "एक":1, "दो":2, "तीन":3, "चार":4, "पाँच":5, "पांच":5, "छह":6, "सात":7,
    "आठ":8, "नौ":9, "दस":10, "बीस":20, "सौ":100, "हज़ार":1000, "हजार":1000,
  };
  const SCALES = {
    hundred:100, thousand:1000, lakh:100000, lac:100000, lakhs:100000,
    sau:100, so:100, saw:100, hazar:1000, hazaar:1000, hazār:1000,
  };

  // Devanagari / Arabic-Indic digit normalisation
  function normalizeDigits(s) {
    const map = {
      "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
      "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
      "०":"0","१":"1","२":"2","३":"3","४":"4","५":"5","६":"6","७":"7","८":"8","९":"9",
    };
    return s.replace(/[۰-۹٠-٩०-९]/g, (d) => map[d] || d);
  }

  function wordsToNumber(text) {
    if (text == null) return null;
    let s = normalizeDigits(String(text).toLowerCase());

    // 1) If it already contains plain digits, take the biggest number chunk.
    const digitMatches = s.replace(/[,،]/g, "").match(/\d+(\.\d+)?/g);
    if (digitMatches) {
      return Math.max(...digitMatches.map(Number));
    }

    // 2) Otherwise parse spelled-out words.
    const tokens = s.split(/[\s-]+/).filter(Boolean);
    let total = 0, current = 0, found = false;
    for (const tok of tokens) {
      if (tok in UNITS) {
        const v = UNITS[tok];
        found = true;
        if (v === 100 || v === 1000) {
          current = (current || 1) * v;
          if (v === 1000) { total += current; current = 0; }
        } else {
          current += v;
        }
      } else if (tok in SCALES) {
        found = true;
        const sc = SCALES[tok];
        current = (current || 1) * sc;
        if (sc >= 1000) { total += current; current = 0; }
      }
    }
    if (!found) return null;
    return total + current;
  }

  return { isSupported, listen, stop, wordsToNumber, normalizeDigits };
})();
