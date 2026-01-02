// ================= CONFIG =================

const BACKEND_BASE = "https://iv-data-logger.onrender.com";
const HEALTH_URL = `${BACKEND_BASE}/health`;
const PROCESS_URL = `${BACKEND_BASE}/process-option-chain`;

const statusEl = document.getElementById("serverStatus");
const processBtn = document.getElementById("processBtn");

let serverActive = false;

// ================= SERVER STATUS =================

function setStatus(text, cls) {
    statusEl.innerText = text;
    statusEl.className = `status ${cls}`;
}

async function checkServer() {
    try {
        const res = await fetch(HEALTH_URL, { cache: "no-store" });
        if (res.ok) {
            serverActive = true;
            setStatus("Active", "active");
            processBtn.disabled = false;
            return;
        }
    } catch (e) {}

    serverActive = false;
    setStatus("Waking up…", "waking");
}

function startServerWatcher() {
    setStatus("Sleeping", "sleeping");
    const interval = setInterval(async () => {
        await checkServer();
        if (serverActive) clearInterval(interval);
    }, 5000);
}

window.onload = startServerWatcher;

// ================= MAIN BUTTON =================

function processCSV() {
    if (!serverActive) {
        alert("Backend is waking up. Please wait.");
        return;
    }

    const fileInput = document.getElementById("csvFile");
    const symbol = document.getElementById("symbol").value;
    const date = document.getElementById("date").value;
    const spot = document.getElementById("spot").value;

    if (!fileInput.files.length || !spot || !date) {
        alert("Please fill all fields");
        return;
    }

    const strikeStep = symbol === "BANKNIFTY" ? 100 : 50;

    Papa.parse(fileInput.files[0], {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            console.log("CSV HEADERS:", Object.keys(results.data[0] || {}));

            const parsed = parseOptionChain(results.data);

            console.log(
                "PARSED STRIKES (first 10):",
                parsed.slice(0, 10).map(r => r.strike)
            );

            sendToBackend(symbol, date, spot, strikeStep, parsed);
        }
    });
}

// ================= NSE OPTION CHAIN PARSER =================

function parseOptionChain(rows) {
    const parsed = [];
    if (!rows.length) return parsed;

    // -------- Detect STRIKE column dynamically --------
    const headers = Object.keys(rows[0]);

    let strikeKey = null;
    for (const key of headers) {
        const sample = rows[0][key];
        if (
            sample &&
            !isNaN(sample) &&
            Number(sample) % 50 === 0 &&
            Number(sample) > 1000
        ) {
            strikeKey = key;
            break;
        }
    }

    console.log("DETECTED STRIKE COLUMN:", strikeKey);

    if (!strikeKey) return parsed;

    rows.forEach(row => {
        const strike = Number(
            (row[strikeKey] || "").toString().replace(/,/g, "")
        );

        const ce_iv = Number(row["IV"]);
        const pe_iv = Number(row["IV_1"]);

        const ce_oi = Number(
            (row["OI"] || "").toString().replace(/,/g, "")
        );
        const pe_oi = Number(
            (row["OI_1"] || "").toString().replace(/,/g, "")
        );

        if (
            isNaN(strike) ||
            isNaN(ce_iv) ||
            isNaN(pe_iv)
        ) return;

        parsed.push({
            strike,
            ce_iv,
            pe_iv,
            ce_oi,
            pe_oi
        });
    });

    return parsed;
}

// ================= BACKEND =================

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
    .then(async res => {
        const data = await res.json();
        console.log("BACKEND STATUS:", res.status);
        console.log("BACKEND RESPONSE:", data);

        document.getElementById("status").innerText =
            data.status === "success"
                ? "✅ Saved successfully"
                : "❌ " + JSON.stringify(data);
    })
    .catch(err => {
        console.error("FETCH ERROR:", err);
        document.getElementById("status").innerText = "❌ Backend error";
    });
}
