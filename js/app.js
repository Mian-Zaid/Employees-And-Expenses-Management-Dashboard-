/*
 * app.js — UI wiring for the Thekedar Dashboard.
 * Ties together Store (localStorage) and Speech (Web Speech API).
 */
(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const rs = (n) => "Rs " + Number(n || 0).toLocaleString("en-PK");
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const ATT_LABEL = { "1": "Full", "0.5": "Half", "1.5": "OT", "2": "Double", "0": "Absent" };

  function toast(msg, isError = false) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast" + (isError ? " error" : "");
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2600);
  }

  // ---------- tab switching ----------
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      $$(".tab-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $("#tab-" + tab.dataset.tab).classList.add("active");
      if (tab.dataset.tab === "daily") { renderWorkerSelect(); renderEntries(); }
      if (tab.dataset.tab === "weekly") renderWeekly();
    });
  });

  // ---------- speech language ----------
  const langSel = $("#speechLang");
  langSel.value = Store.getSetting("speechLang", "ur-PK");
  langSel.addEventListener("change", () => Store.setSetting("speechLang", langSel.value));
  const currentLang = () => langSel.value;

  // ---------- mic buttons (fill a single field) ----------
  function wireMic(btn) {
    btn.addEventListener("click", async () => {
      if (!Speech.isSupported()) {
        toast("Voice not supported in this browser. Use Chrome.", true);
        return;
      }
      const target = $("#" + btn.dataset.target);
      const isNumber = btn.dataset.number === "1";
      const statusEl = $("#micStatus");
      btn.classList.add("recording");
      statusEl.hidden = false;
      try {
        const text = await Speech.listen(currentLang());
        if (text) {
          if (isNumber) {
            const n = Speech.wordsToNumber(text);
            target.value = n != null ? n : Speech.normalizeDigits(text);
          } else {
            target.value = text;
          }
          target.dispatchEvent(new Event("input"));
        }
      } catch (e) {
        toast("Could not hear that — try again.", true);
      } finally {
        btn.classList.remove("recording");
        statusEl.hidden = true;
      }
    });
  }
  $$(".mic").forEach(wireMic);

  // ---------- WORKERS ----------
  const workerForm = $("#workerForm");
  let editingWorkerId = null;

  workerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      name: $("#wName").value.trim(),
      role: $("#wRole").value,
      wage: Number($("#wWage").value) || 0,
      phone: $("#wPhone").value.trim(),
    };
    if (!payload.name) return;
    if (editingWorkerId) {
      Store.updateWorker(editingWorkerId, payload);
      toast("Worker updated ✓");
    } else {
      Store.addWorker(payload);
      toast("Worker added ✓");
    }
    resetWorkerForm();
    renderWorkers();
    renderWorkerSelect();
  });

  $("#workerCancelBtn").addEventListener("click", resetWorkerForm);

  function resetWorkerForm() {
    workerForm.reset();
    editingWorkerId = null;
    $("#workerSubmitBtn").textContent = "Add Worker";
    $("#workerCancelBtn").hidden = true;
  }

  function editWorker(id) {
    const w = Store.getWorker(id);
    if (!w) return;
    $("#wName").value = w.name;
    $("#wRole").value = w.role;
    $("#wWage").value = w.wage;
    $("#wPhone").value = w.phone || "";
    editingWorkerId = id;
    $("#workerSubmitBtn").textContent = "Save Changes";
    $("#workerCancelBtn").hidden = false;
    $("#wName").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderWorkers() {
    const workers = Store.getWorkers();
    const tbody = $("#workersTable tbody");
    tbody.innerHTML = "";
    $("#workerCount").textContent = workers.length ? `(${workers.length})` : "";
    $("#workersEmpty").hidden = workers.length > 0;
    $("#workersTable").hidden = workers.length === 0;

    workers.forEach((w) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(w.name)}</td>
        <td><span class="role-badge">${escapeHtml(w.role)}</span></td>
        <td class="num">${rs(w.wage)}</td>
        <td>${escapeHtml(w.phone || "—")}</td>
        <td style="text-align:right; white-space:nowrap">
          <button class="btn-icon" data-edit="${w.id}" title="Edit">✏️</button>
          <button class="btn-icon danger" data-del="${w.id}" title="Delete">🗑️</button>
        </td>`;
      tbody.appendChild(tr);
    });

    $$("[data-edit]", tbody).forEach((b) =>
      b.addEventListener("click", () => editWorker(b.dataset.edit))
    );
    $$("[data-del]", tbody).forEach((b) =>
      b.addEventListener("click", () => {
        const w = Store.getWorker(b.dataset.del);
        if (confirm(`Delete ${w?.name}? This also removes their entries.`)) {
          Store.deleteWorker(b.dataset.del);
          renderWorkers();
          renderWorkerSelect();
          toast("Worker deleted");
        }
      })
    );
  }

  // ---------- DAILY ENTRY ----------
  const dailyForm = $("#dailyForm");
  $("#dDate").value = todayISO();

  function renderWorkerSelect() {
    const sel = $("#dWorker");
    const workers = Store.getWorkers();
    const prev = sel.value;
    sel.innerHTML = workers.length
      ? workers.map((w) => `<option value="${w.id}">${escapeHtml(w.name)} — ${escapeHtml(w.role)} (${rs(w.wage)})</option>`).join("")
      : `<option value="">Add a worker first</option>`;
    if (prev) sel.value = prev;
  }

  dailyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const workerId = $("#dWorker").value;
    if (!workerId) { toast("Add a worker first", true); return; }
    Store.addEntry({
      workerId,
      date: $("#dDate").value || todayISO(),
      attendance: Number($("#dAttendance").value),
      advance: Number($("#dAdvance").value) || 0,
      note: $("#dNote").value.trim(),
    });
    $("#dAdvance").value = 0;
    $("#dNote").value = "";
    renderEntries();
    toast("Entry saved ✓");
  });

  function renderEntries() {
    const workers = Object.fromEntries(Store.getWorkers().map((w) => [w.id, w]));
    const entries = Store.getEntries()
      .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
      .slice(0, 25);
    const tbody = $("#entriesTable tbody");
    tbody.innerHTML = "";
    $("#entriesEmpty").hidden = entries.length > 0;
    $("#entriesTable").hidden = entries.length === 0;

    entries.forEach((en) => {
      const w = workers[en.workerId];
      const wage = w ? w.wage * en.attendance : 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${en.date}</td>
        <td>${w ? escapeHtml(w.name) : "—"}</td>
        <td>${ATT_LABEL[String(en.attendance)] ?? en.attendance}</td>
        <td class="num">${rs(wage)}</td>
        <td class="num">${en.advance ? rs(en.advance) : "—"}</td>
        <td>${escapeHtml(en.note || "")}</td>
        <td style="text-align:right"><button class="btn-icon danger" data-del="${en.id}">🗑️</button></td>`;
      tbody.appendChild(tr);
    });
    $$("[data-del]", tbody).forEach((b) =>
      b.addEventListener("click", () => {
        Store.deleteEntry(b.dataset.del);
        renderEntries();
        toast("Entry deleted");
      })
    );
  }

  // ---------- Voice Quick Entry ----------
  // Parses a spoken sentence like "Aslam full day advance 500" or
  // "اسلم آدھا دن پیشگی پانچ سو" into worker + attendance + advance.
  $("#voiceQuick").addEventListener("click", async () => {
    if (!Speech.isSupported()) { toast("Voice not supported. Use Chrome.", true); return; }
    if (!Store.getWorkers().length) { toast("Add a worker first", true); return; }
    const statusEl = $("#micStatus");
    statusEl.hidden = false;
    try {
      const text = await Speech.listen(currentLang());
      statusEl.hidden = true;
      if (!text) return;
      applyVoiceQuick(text);
    } catch (e) {
      statusEl.hidden = true;
      toast("Could not hear that — try again.", true);
    }
  });

  function applyVoiceQuick(text) {
    const lower = Speech.normalizeDigits(text.toLowerCase());
    // match worker by name appearing in the phrase
    const worker = Store.getWorkers().find((w) =>
      lower.includes(w.name.toLowerCase())
    );
    if (worker) $("#dWorker").value = worker.id;

    // attendance keywords
    let att = "1";
    if (/half|aadha|adha|آدھا|आधा/.test(lower)) att = "0.5";
    else if (/overtime|over time|ot|اوور|ओवर/.test(lower)) att = "1.5";
    else if (/double|dugna|ڈبل|दुगना|डबल/.test(lower)) att = "2";
    else if (/absent|nagha|nagah|chutti|غیر حاضر|छुट्टी|absent/.test(lower)) att = "0";
    $("#dAttendance").value = att;

    // advance amount: look for a number near advance/peshgi keyword, else any number
    let advance = 0;
    const advMatch = lower.match(/(?:advance|peshgi|peshgee|kharcha|kharch|پیشگی|خرچہ|पेशगी|एडवांस)\s*([^\d]*\d[\d,،.]*|[^\.]*)$/);
    if (advMatch && advMatch[1]) {
      const n = Speech.wordsToNumber(advMatch[1]);
      if (n != null) advance = n;
    }
    if (!advance) {
      const n = Speech.wordsToNumber(lower);
      if (n != null) advance = n;
    }
    $("#dAdvance").value = advance || 0;
    $("#dNote").value = text;

    const label = worker ? worker.name : "(pick worker)";
    $("#voiceQuickHint").textContent =
      `Heard: “${text}” → ${label}, ${ATT_LABEL[att]}, advance ${rs(advance)}. Review & Save.`;
    toast("Voice parsed — review and Save ✓");
  }

  // ---------- WEEKLY SETTLEMENT ----------
  let weekOffset = 0; // 0 = current week

  function weekBounds(offset) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const day = now.getDay(); // 0 Sun .. 6 Sat
    const diffToMon = (day + 6) % 7; // Monday as start
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMon + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const iso = (d) => d.toISOString().slice(0, 10);
    return { start: iso(monday), end: iso(sunday), startD: monday, endD: sunday };
  }

  function fmtDate(d) {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function renderWeekly() {
    const { start, end, startD, endD } = weekBounds(weekOffset);
    $("#weekRange").textContent = `${fmtDate(startD)} – ${fmtDate(endD)}, ${endD.getFullYear()}`;

    const workers = Store.getWorkers();
    const entries = Store.getEntriesBetween(start, end);

    // aggregate per worker
    const agg = {};
    entries.forEach((e) => {
      const a = (agg[e.workerId] ||= { days: 0, advance: 0 });
      a.days += e.attendance;
      a.advance += e.advance || 0;
    });

    const rows = workers
      .map((w) => {
        const a = agg[w.id] || { days: 0, advance: 0 };
        return { w, days: a.days, earned: a.days * w.wage, advance: a.advance };
      })
      .filter((r) => r.days > 0 || r.advance > 0);

    const tbody = $("#weeklyTable tbody");
    tbody.innerHTML = "";
    $("#weeklyEmpty").hidden = rows.length > 0;
    $("#weeklyTable").hidden = rows.length === 0;

    let tDays = 0, tEarned = 0, tAdvance = 0, tNet = 0;
    rows.forEach((r) => {
      const net = r.earned - r.advance;
      tDays += r.days; tEarned += r.earned; tAdvance += r.advance; tNet += net;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.w.name)} <span class="role-badge">${escapeHtml(r.w.role)}</span></td>
        <td class="num">${r.days}</td>
        <td class="num">${rs(r.w.wage)}</td>
        <td class="num">${rs(r.earned)}</td>
        <td class="num">${rs(r.advance)}</td>
        <td class="num ${net >= 0 ? "net-pos" : "net-neg"}">${rs(net)}</td>`;
      tbody.appendChild(tr);
    });

    $("#tDays").textContent = tDays;
    $("#tEarned").textContent = rs(tEarned);
    $("#tAdvance").textContent = rs(tAdvance);
    $("#tNet").textContent = rs(tNet);
    $("#tDays").className = $("#tEarned").className = $("#tAdvance").className = $("#tNet").className = "num";
  }

  $("#weekPrev").addEventListener("click", () => { weekOffset--; renderWeekly(); });
  $("#weekNext").addEventListener("click", () => { weekOffset++; renderWeekly(); });
  $("#weekToday").addEventListener("click", () => { weekOffset = 0; renderWeekly(); });
  $("#weekPrint").addEventListener("click", () => window.print());

  // ---------- misc ----------
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // Hide mic buttons entirely if unsupported (keeps UI clean)
  if (!Speech.isSupported()) {
    $$(".mic").forEach((m) => (m.style.display = "none"));
    $("#voiceQuick").disabled = true;
    $("#voiceQuickHint").textContent = "Voice input needs Chrome / Edge on this device.";
  }

  // ---------- init ----------
  renderWorkers();
  renderWorkerSelect();
  renderEntries();
})();
