const BACKEND_BASE = "https://iv-data-logger.onrender.com";
const PROCESS_URL = `${BACKEND_BASE}/process-option-chain`;

let previewPayload = null;

// ---------- STATUS MESSAGE ----------

function showStatus(msg, success = true) {
    const el = document.getElementById("status");
    el.innerText = msg;
    el.style.color = success ? "green" : "red";

    setTimeout(() => {
        el.innerText = "";
    }, 3000);
}

// ---------- PROCESS CSV ----------

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
            showStatus("Preview failed", false);
            return;
        }

        previewPayload = { symbol, date, spot, strike_step: strikeStep, option_chain: optionChain };
        renderPreview(d.data);
    });
}

// ---------- RENDER PREVIEW ----------

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

// ---------- CONFIRM SAVE ----------

function confirmSave() {
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
            showStatus("✅ Data saved to GitHub");
        } else {
            showStatus("❌ Save failed", false);
        }
        document.getElementById("previewSection").style.display = "none";
        previewPayload = null;
    });
}
