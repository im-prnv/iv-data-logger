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
        alert("Backend waking up. Wait.");
        return;
    }

    const file = document.getElementById("csvFile").files[0];
    const symbol = document.getElementById("symbol").value;
    const date = document.getElementById("date").value;
    const spot = document.getElementById("spot").value;

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
            console.log("FIRST 10 STRIKES:", parsed.slice(0, 10).map(r => r.strike));
            sendToBackend(symbol, date, spot, strikeStep, parsed);
        }
    });
}

// ---------------- NSE PARSER (CORRECT) ----------------

function parseNSEOptionChain(rows) {
    const parsed = [];

    for (const row of rows) {
        if (!Array.isArray(row)) continue;

        const mid = Math.floor(row.length / 2);
        const strike = Number(row[mid]);

        // REAL DATA ROW IDENTIFIER:
        // middle cell must be numeric & divisible by 50/100
        if (!strike || isNaN(strike)) continue;
        if (strike % 50 !== 0 && strike % 100 !== 0) continue;

        // CALL side (left)
        const ce_oi = Number((row[0] || "").toString().replace(/,/g, "")) || 0;
        const ce_iv = Number(row[3]);

        // PUT side (right)
        const pe_iv = Number(row[row.length - 4]);
        const pe_oi = Number((row[row.length - 1] || "").toString().replace(/,/g, "")) || 0;

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
