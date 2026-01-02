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

// ================= MAIN BUTTON HANDLER =================

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
            console.log("RAW CSV HEADERS:", Object.keys(results.data[0] || {}));

            const parsed = parseOptionChain(results.data);

            console.log("PARSED SAMPLE:", parsed.slice(0, 5));

            sendToBackend(symbol, date, spot, strikeStep, parsed);
        }
    });
}

// ================= NSE OPTION CHAIN PARSER =================

function parseOptionChain(rows) {
    const parsed = [];

    rows.forEach(row => {
        // ---- STRIKE PRICE (NSE standard) ----
        const strikeRaw = row["STRIKE PRICE"];
        if (!strikeRaw) return;

        const strike = Number(strikeRaw.toString().replace(/,/g, ""));

        // ---- CALL SIDE (LEFT) ----
        const ce_iv = Number(row["IV"]);
        const ce_oi = Number(
            (row["OI"] || "").toString().replace(/,/g, "")
        );

        // ---- PUT SIDE (RIGHT) ----
        // PapaParse renames duplicate headers as _1
        const pe_iv = Number(row["IV_1"]);
        const pe_oi = Number(
            (row["OI_1"] || "").toString().replace(/,/g, "")
        );

        // ---- VALIDATION ----
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

// ================= BACKEND CALL =================

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
