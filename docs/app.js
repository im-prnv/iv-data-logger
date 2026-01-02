const BACKEND_BASE = "https://iv-data-logger.onrender.com";
const HEALTH_URL = `${BACKEND_BASE}/health`;
const PROCESS_URL = `${BACKEND_BASE}/process-option-chain`;

const statusEl = document.getElementById("serverStatus");
const processBtn = document.getElementById("processBtn");

let serverActive = false;

// ---------- SERVER STATUS ----------

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
    } catch {}
    setStatus("Waking up…", "waking");
}

function startServerWatcher() {
    setStatus("Sleeping", "sleeping");
    const i = setInterval(async () => {
        await checkServer();
        if (serverActive) clearInterval(i);
    }, 5000);
}

window.onload = startServerWatcher;

// ---------- MAIN ----------

function processCSV() {
    if (!serverActive) {
        alert("Backend is waking up");
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
            const parsed = parseOptionChain(res.data);
            console.log("OPTION CHAIN LENGTH:", parsed.length);
            console.log("FIRST 10 STRIKES:", parsed.slice(0, 10).map(r => r.strike));
            sendToBackend(symbol, date, spot, strikeStep, parsed);
        }
    });
}

// ---------- NSE PARSER (FINAL) ----------

function parseOptionChain(rows) {
    const parsed = [];

    rows.forEach(row => {
        if (!row || row.length < 20) return;

        const len = row.length;
        const strikeIndex = Math.floor(len / 2);

        const strike = Number(row[strikeIndex]);
        if (isNaN(strike)) return;

        const ce_iv = Number(row[3]) || null;
        const pe_iv = Number(row[len - 4]) || null;

        const ce_oi = Number((row[0] || "").toString().replace(/,/g, "")) || 0;
        const pe_oi = Number((row[len - 1] || "").toString().replace(/,/g, "")) || 0;

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

// ---------- BACKEND ----------

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
            d.status === "success" ? "✅ Saved" : "❌ " + d.error;
    })
    .catch(e => console.error(e));
}
