const BACKEND_BASE = "https://iv-data-logger.onrender.com";
const HEALTH_URL = `${BACKEND_BASE}/health`;
const PROCESS_URL = `${BACKEND_BASE}/process-option-chain`;

const statusEl = document.getElementById("serverStatus");
const processBtn = document.getElementById("processBtn");

let serverActive = false;

// ---------------- SERVER WAKE LOGIC ----------------

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

// ---------------- CSV PROCESSING ----------------

function processCSV() {
    if (!serverActive) {
        alert("Server is waking up. Please wait.");
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
            const parsed = parseOptionChain(results.data);
            sendToBackend(symbol, date, spot, strikeStep, parsed);
        }
    });
}

// ---------------- NSE CSV PARSING ----------------

function parseOptionChain(rows) {
    const parsed = [];

    rows.forEach(row => {
        const values = Object.values(row);
        if (values.length < 15) return;

        const strike = Number(values[Math.floor(values.length / 2)]);
        const ce_iv = Number(values[3]);
        const pe_iv = Number(values[values.length - 4]);

        const ce_oi = Number(values[0].toString().replace(/,/g, ""));
        const pe_oi = Number(values[values.length - 1].toString().replace(/,/g, ""));

        if (!strike || isNaN(ce_iv) || isNaN(pe_iv)) return;

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

// ---------------- BACKEND CALL ----------------

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
        console.log("BACKEND:", data);
        document.getElementById("status").innerText =
            data.status === "success"
                ? "✅ Saved successfully"
                : "❌ " + JSON.stringify(data);
    })
    .catch(err => {
        console.error(err);
        document.getElementById("status").innerText = "❌ Backend error";
    });
}
