const BACKEND_BASE = "https://iv-data-logger.onrender.com";
const HEALTH_URL = `${BACKEND_BASE}/health`;
const PROCESS_URL = `${BACKEND_BASE}/process-option-chain`;

const statusEl = document.getElementById("serverStatus");
const processBtn = document.getElementById("processBtn");

let serverActive = false;

// ---------------- SERVER STATUS ----------------

function setStatus(text, cls) {
    statusEl.innerText = text;
    statusEl.className = `status ${cls}`;
}

async function checkServer() {
    try {
        const r = await fetch(HEALTH_URL, { cache: "no-store" });
        if (r.ok) {
            serverActive = true;
            setStatus("Active", "active");
            processBtn.disabled = false;
            return;
        }
    } catch {}
    setStatus("Waking up…", "waking");
}

function startServerWatcher() {
    setStatus("Sleeping", "sleeping");
    const t = setInterval(async () => {
        await checkServer();
        if (serverActive) clearInterval(t);
    }, 5000);
}

window.onload = startServerWatcher;

// ---------------- MAIN ----------------

function processCSV() {
    if (!serverActive) {
        alert("Backend waking up. Please wait.");
        return;
    }

    const file = document.getElementById("csvFile").files[0];
    const symbol = document.getElementById("symbol").value;
    const date = document.getElementById("date").value;
    const spot = Number(document.getElementById("spot").value);

    if (!file || !date || !spot) {
        alert("Fill all fields");
        return;
    }

    const strikeStep = symbol === "BANKNIFTY" ? 100 : 50;

    Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: res => {
            const parsed = parseNSEOptionChain(res.data);
            console.log("OPTION CHAIN LENGTH:", parsed.length);
            console.log("FIRST 5 ROWS:", parsed.slice(0, 5));
            sendToBackend(symbol, date, spot, strikeStep, parsed);
        }
    });
}

// ---------------- NSE OPTION CHAIN PARSER (CORRECT MAPPING) ----------------

function parseNSEOptionChain(rows) {
    const parsed = [];
    if (!rows || rows.length < 3) return parsed;

    // Header row contains STRIKE
    const headerRow = rows[1];
    const strikeIndex = headerRow.findIndex(
        h => String(h).trim().toUpperCase() === "STRIKE"
    );

    if (strikeIndex === -1) {
        console.error("STRIKE column not found");
        return parsed;
    }

    // CALL IV = 4 columns LEFT of STRIKE
    // PUT IV  = 6 columns RIGHT of STRIKE
    const CE_IV_INDEX = strikeIndex - 4;
    const CE_OI_INDEX = strikeIndex - 9;

    const PE_IV_INDEX = strikeIndex + 6;
    const PE_OI_INDEX = strikeIndex + 9;

    for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length <= PE_OI_INDEX) continue;

        const strike = Number(
            String(row[strikeIndex]).replace(/,/g, "")
        );
        if (isNaN(strike)) continue;

        const ce_iv = Number(row[CE_IV_INDEX]);
        const pe_iv = Number(row[PE_IV_INDEX]);

        const ce_oi = Number(
            String(row[CE_OI_INDEX] || "").replace(/,/g, "")
        ) || 0;

        const pe_oi = Number(
            String(row[PE_OI_INDEX] || "").replace(/,/g, "")
        ) || 0;

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

// ---------------- BACKEND ----------------

function sendToBackend(symbol, date, spot, strikeStep, optionChain) {
    fetch(PROCESS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            symbol,
            date,
            spot,
            strike_step: strikeStep,
            option_chain: optionChain
        })
    })
    .then(r => r.json())
    .then(d => {
        console.log("BACKEND:", d);
        document.getElementById("status").innerText =
            d.status === "success"
                ? "✅ Saved successfully"
                : "❌ " + d.error;
    })
    .catch(e => console.error(e));
}
