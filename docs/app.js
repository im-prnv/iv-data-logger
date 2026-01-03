const BACKEND_BASE = "https://iv-data-logger.onrender.com";
const HEALTH_URL = `${BACKEND_BASE}/health`;
const PROCESS_URL = `${BACKEND_BASE}/process-option-chain`;

let backendAwake = false;
let previewPayload = null;

const backendEl = document.getElementById("backendStatus");
const processBtn = document.getElementById("processBtn");

/* ================= BACKEND WAKE LOOP ================= */

async function wakeBackend() {
  if (backendAwake) return;

  try {
    backendEl.textContent = "Backend: Waking…";
    backendEl.className = "status status-wake";

    const r = await fetch(HEALTH_URL, { cache: "no-store" });
    if (r.ok) {
      backendAwake = true;
      backendEl.textContent = "Backend: Active";
      backendEl.className = "status status-live";
      processBtn.disabled = false;
      return;
    }
  } catch {}

  backendEl.textContent = "Backend: Sleeping";
  backendEl.className = "status status-sleep";
  processBtn.disabled = true;
}

setInterval(wakeBackend, 5000);
window.addEventListener("load", wakeBackend);

/* ================= STATUS MESSAGE ================= */

function showStatus(msg, ok = true) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.color = ok ? "#22c55e" : "#f87171";
  setTimeout(() => el.textContent = "", 3000);
}

/* ================= NSE CSV PARSER ================= */

function parseNSEOptionChain(rows) {
  const parsed = [];
  if (!rows || rows.length < 3) return parsed;

  const header = rows[1];
  const strikeIndex = header.findIndex(h => String(h).trim().toUpperCase() === "STRIKE");
  if (strikeIndex === -1) return parsed;

  const CE_OI = strikeIndex - 10;
  const CE_IV = strikeIndex - 7;
  const PE_IV = strikeIndex + 7;
  const PE_OI = strikeIndex + 10;

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length <= PE_OI) continue;

    const strike = Number(String(r[strikeIndex]).replace(/,/g, ""));
    if (isNaN(strike)) continue;

    const ce_iv = Number(r[CE_IV]);
    const pe_iv = Number(r[PE_IV]);

    parsed.push({
      strike,
      ce_iv: isNaN(ce_iv) ? null : ce_iv,
      pe_iv: isNaN(pe_iv) ? null : pe_iv,
      ce_oi: Number(String(r[CE_OI]).replace(/,/g, "")) || 0,
      pe_oi: Number(String(r[PE_OI]).replace(/,/g, "")) || 0
    });
  }

  return parsed;
}

/* ================= HANDLE PROCESS (FIXED) ================= */

processBtn.addEventListener("click", handleProcess);

function handleProcess() {
  const file = document.getElementById("csvFile").files[0];
  const symbol = document.getElementById("symbol").value;
  const date = document.getElementById("date").value;
  const spot = Number(document.getElementById("spot").value);

  if (!file || !date || !spot) {
    showStatus("Fill all fields", false);
    return;
  }

  const strikeStep = symbol === "BANKNIFTY" ? 100 : 50;

  Papa.parse(file, {
    header: false,
    skipEmptyLines: true,
    complete: res => {
      const chain = parseNSEOptionChain(res.data);
      sendPreview(symbol, date, spot, strikeStep, chain);
    }
  });
}

/* ================= PREVIEW ================= */

function sendPreview(symbol, date, spot, step, chain) {
  fetch(PROCESS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol,
      date,
      spot,
      strike_step: step,
      option_chain: chain,
      preview_only: true
    })
  })
  .then(r => r.json())
  .then(d => {
    if (d.status !== "preview") {
      showStatus(d.error || "Preview failed", false);
      return;
    }

    previewPayload = { symbol, date, spot, strike_step: step, option_chain: chain };
    renderPreview(d.data);
  })
  .catch(() => showStatus("Backend error", false));
}

function renderPreview(data) {
  const body = document.getElementById("previewTable");
  body.innerHTML = "";

  Object.entries(data).forEach(([k, v]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${k}</td><td>${v}</td>`;
    body.appendChild(tr);
  });

  document.getElementById("previewSection").style.display = "block";
}

/* ================= CONFIRM SAVE ================= */

function confirmSave() {
  fetch(PROCESS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...previewPayload, preview_only: false })
  })
  .then(r => r.json())
  .then(d => {
    if (d.status === "success") {
      showStatus("Data saved successfully");
    } else {
      showStatus("Save failed", false);
    }
    document.getElementById("previewSection").style.display = "none";
    previewPayload = null;
  });
}
