/*
 * nlu.js — Tiny natural-language parser for the Global Mic.
 *
 * Turns a free spoken sentence (Urdu / Hindi / Roman-Urdu / English) into a
 * structured command the app can execute:
 *
 *   { intent: "addWorker", name, role, wage }
 *   { intent: "dailyEntry", workerId, name, attendance, advance, dateOffset }
 *   { intent: "unknown", reason }
 *
 * It is heuristic and best-effort — the UI always shows what it understood and
 * offers an Undo, so a wrong guess is never destructive.
 */
const NLU = (() => {
  // ---- keyword vocab (single tokens, all scripts) ----
  const ROLE_MAP = [
    [/mistri|مستری|मिस्त्री/, "Mistri"],
    [/mazdoor|mazdur|mazdor|مزدور|मजदूर|मज़दूर/, "Mazdoor"],
    [/helper|ہیلپر|हेल्पर/, "Helper"],
  ];
  const ROLE_TOKENS = /^(mistri|mazdoor|mazdur|mazdoor|helper|مستری|مزدور|ہیلپر|मिस्त्री|मजदूर|हेल्पर)$/;

  const ADD_RE = /\b(naya|naya|naii|nai|new|add|register|bharti|bhrti|shamil|jodo|jodo|rakho|likho)\b|نیا|نئی|بھرتی|شامل|جوڑو|नया|नई|भर्ती|शामिल|जोड़ो/;
  const WAGE_TOKENS = new Set(["dihari","dihaari","dihadi","dehari","dyhari","dihari","wage","rate","mazdoori","mazduri","mehnat","دیہاڑی","دہاڑی","मजदूरी","दिहाड़ी"]);
  const ADV_TOKENS = new Set(["advance","adwance","peshgi","peshgee","peshagi","kharcha","kharch","kharcha","udhaar","udhar","udhaar","diye","diya","diye","de","دیے","پیشگی","خرچہ","ادھار","एडवांस","पेशगी","उधार","दिए","दिया"]);

  const ATT = [
    [/half|aadha|adha|aadhi|adhi|آدھا|आधा|आधी/, 0.5],
    [/overtime|over ?time|\bot\b|اوور|ओवरटाइम|ओवर/, 1.5],
    [/double|dugna|duguna|ڈبل|दुगना|डबल/, 2],
    [/absent|nagha|nagah|naghah|chutti|chhutti|ghair ?haazir|ghair ?hazir|غیر ?حاضر|ناغہ|छुट्टी|गैरहाज़िर|गैरहाजिर/, 0],
    [/full|poora|pura|puri|poori|present|aaya|aya|haazir|hazir|پورا|حاضر|पूरा|पूरी|हाज़िर|आया/, 1],
  ];

  const DATE_RE = [
    [/parso|پرسوں|परसों/, -2],
    [/kal|yesterday|کل|कल/, -1],
    [/aaj|aj|today|آج|आज/, 0],
  ];

  // filler words to strip when guessing a worker name
  const FILLER = new Set([
    "ko","ki","ka","ke","ne","se","ka","aur","or","hai","hy","h","ha","rupay","rupaye",
    "rupee","rupees","roopay","rs","din","day","days","the","a","an","naya","nayi","nai",
    "new","add","register","bharti","shamil","jodo","rakho","likho","banao","bana","kro","karo",
    "دن","روپے","کو","کی","کا","نیا","के","को","रुपए","रुपये","दिन",
  ]);

  const tokenize = (s) => Speech.normalizeDigits(s.toLowerCase()).split(/[\s,،۔.]+/).filter(Boolean);

  function detect(re, text, fallback = null) {
    for (const [rx, val] of re) if (rx.test(text)) return val;
    return fallback;
  }
  function detectRole(text) { return detect(ROLE_MAP, text, null); }

  // grab a number in a contiguous run immediately after (preferred) or before idx
  function numberRunAround(tokens, idx) {
    const collect = (dir) => {
      const vals = [];
      let j = idx + dir;
      while (j >= 0 && j < tokens.length && Speech.isNumberWord(tokens[j])) {
        dir > 0 ? vals.push(tokens[j]) : vals.unshift(tokens[j]);
        j += dir;
      }
      return vals;
    };
    let run = collect(1);
    if (!run.length) run = collect(-1);
    return run.length ? Speech.wordsToNumber(run.join(" ")) : null;
  }

  function findKw(tokens, set) {
    for (let i = 0; i < tokens.length; i++) if (set.has(tokens[i])) return i;
    return -1;
  }

  function parse(rawText, workers) {
    if (!rawText || !rawText.trim()) return { intent: "unknown", reason: "empty" };
    const text = Speech.normalizeDigits(rawText.toLowerCase());
    const tokens = tokenize(rawText);

    const role = detectRole(text);
    const anyNumber = Speech.wordsToNumber(text);

    // number tied to a wage keyword / advance keyword
    const wageIdx = findKw(tokens, WAGE_TOKENS);
    const advIdx = findKw(tokens, ADV_TOKENS);
    const wageNear = wageIdx >= 0 ? numberRunAround(tokens, wageIdx) : null;
    const advNear = advIdx >= 0 ? numberRunAround(tokens, advIdx) : null;

    // does the sentence name an existing worker?
    const existing = (workers || []).find((w) =>
      w.name && text.includes(w.name.toLowerCase())
    );

    const explicitAdd = ADD_RE.test(text);
    const hasRole = !!role;

    // ---- intent decision ----
    let intent;
    if (explicitAdd || (hasRole && !existing)) intent = "addWorker";
    else if (existing) intent = "dailyEntry";
    else if (hasRole) intent = "addWorker";
    else intent = "unknown";

    if (intent === "addWorker") {
      // name = first meaningful non-keyword, non-number token
      const nameTok = tokens.find(
        (t) => !Speech.isNumberWord(t) && !FILLER.has(t) && !ROLE_TOKENS.test(t) &&
               !WAGE_TOKENS.has(t) && !ADV_TOKENS.has(t) && t.length > 1
      );
      const name = nameTok
        ? nameTok.charAt(0).toUpperCase() + nameTok.slice(1)
        : "";
      const wage = wageNear ?? anyNumber ?? 0;
      if (!name && wage === 0) return { intent: "unknown", reason: "no-name" };
      return {
        intent: "addWorker",
        name: name || "Mazdoor",
        role: role || "Mazdoor",
        wage: wage || 0,
      };
    }

    if (intent === "dailyEntry") {
      const attendance = detect(ATT, text, null);
      // advance = number tied to an advance keyword; else a bare number
      // (but never a number that belongs to a "dihari"/wage keyword).
      let advance = advNear;
      if (advance == null) advance = wageIdx >= 0 ? 0 : anyNumber;
      advance = advance || 0;
      const dateOffset = detect(DATE_RE, text, 0);
      return {
        intent: "dailyEntry",
        workerId: existing.id,
        name: existing.name,
        attendance: attendance != null ? attendance : 1, // default full day
        advance: advance || 0,
        dateOffset,
      };
    }

    return { intent: "unknown", reason: "no-match" };
  }

  return { parse };
})();
