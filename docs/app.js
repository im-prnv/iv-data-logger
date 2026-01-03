/* =========================================================
   CONFIG
========================================================= */

const BACKEND_BASE = "https://iv-data-logger.onrender.com";
const HEALTH_URL = `${BACKEND_BASE}/health`;
const PROCESS_URL = `${BACKEND_BASE}/process-option-chain`;

let previewPayload = null;

/* =========================================================
   BACKEND STATUS
========================================================= */

const backendEl = document.getElementById("backendStatus");

async function checkBackend() {
  try {
    backendEl.textContent = "Backend: Waking";
    backendEl.className = "status-wake";

    const r = await fetch(HEALTH_URL, { cache: "no-store" });
    if (r.ok) {
      backendEl.textContent = "Backend: Active";
      backendEl.className = "status-live";
    }
  } catch (e) {
    backendEl.textContent = "Backend: Sleeping";
    backendEl.className = "status-sleep";
  }
}

window.addEventListener("load", checkBackend);

/* =========================================================
   STATUS MESSAGE (AUTO HIDE)
========================================================= */

function showStatus(message, success = true) {
  const el = document.getElementById("status");
  el.textContent = message;
  el.style.color = success ? "#2e9e5b" : "#c0392b";

  setTimeout(() => {
    el.textContent = "";
  }, 3000);
}

/* =========================================================
   CSV PARSING (NSE ED – FINAL MAPPING)
========================================================= */

function parseNSEOptionChain(rows) {
  const parsed = [];
  if (!rows || rows.length < 3) return parsed;

  const headerRow = rows[1];
  const strikeIndex = headerRow.findIndex(
    h => String(h).trim().toUpperCase() === "STRIKE"
  );

  if (strikeIndex === -1) {
    console.error("STRIKE column not found");
    return parsed;
  }

  // NSE ED fixed offsets
  const CE_OI_INDEX = strikeIndex - 10;
  const CE_IV_INDEX = strikeIndex - 7;
  const PE_IV_INDEX = strikeIndex + 7;
  const PE_OI_INDEX = strikeIndex + 10;

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length <= PE_OI_INDEX) continue;

    const strike = Number(String(row[strikeIndex]).replace(/,/g, ""));
    if (isNaN(strike)) continue;

    const ce_iv = Number(row[CE_IV_INDEX]);
    const pe_iv = Number(row[PE_IV_INDEX]);

    const ce_oi = Number(String(row[CE_OI_INDEX] || "").replace(/,/g, "")) || 0;
    const pe_oi = Number(String(row[PE_OI_INDEX] || "").replace(/,/g, "")) || 0;

    parsed.push({
      strike,
      ce_iv: isNaN(ce_iv) ? null : ce_iv,
      pe_iv: isNaN(pe_iv) ? null : pe_iv,
      ce_oi,
      pe_oi
    });
  }

  return parsed;
}

/* =========================================================
   PROCESS & PREVIEW
========================================================= */

function processCSV(symbol, date, spot, strikeStep, optionChain) {
  fetch(PROCESS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol,
      date,
      spot,
      strike_step: strikeStep,
      option_chain: optionChain,
      preview_only: true
    })
  })
    .then(r => r.json())
    .then(d => {
      if (d.status !== "preview") {
        showStatus(d.error || "Preview failed", false);
        return;
      }

      previewPayload = {
        symbol,
        date,
        spot,
        strike_step: strikeStep,
        option_chain: optionChain
      };

      renderPreview(d.data);
    })
    .catch(() => showStatus("Backend error", false));
}

/* =========================================================
   PREVIEW TABLE
========================================================= */

function renderPreview(data) {
  const table = document.getElementById("previewTable");
  table.innerHTML = "";

  Object.entries(data).forEach(([k, v]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><b>${k}</b></td><td>${v}</td>`;
    table.appendChild(tr);
  });

  document.getElementById("previewSection").style.display = "block";
}

/* =========================================================
   CONFIRM SAVE
========================================================= */

function confirmSave() {
  if (!previewPayload) {
    showStatus("Nothing to save", false);
    return;
  }

  fetch(PROCESS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...previewPayload,
      preview_only: false
    })
  })
    .then(r => r.json())
    .then(d => {
      if (d.status === "success") {
        showStatus("✅ Data saved successfully");
      } else {
        showStatus(d.error || "Save failed", false);
      }

      document.getElementById("previewSection").style.display = "none";
      previewPayload = null;
    })
    .catch(() => showStatus("Save failed", false));
}
