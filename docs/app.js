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
    } catch {}

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

// ================= MAIN =================

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
        header: false,               // 🔴 IMPORTANT
        skipEmptyLines: true,
        complete: function (results) {
            const parsed = parseOptionChain(results.data);

            console.log(
                "PARSED STRIKES:",
                parsed.slice(0, 10).map(r => r.strike)
            );

            sendToBackend(symbol, date, spot, strikeStep, parsed);
        }
    });
}

// ================= NSE PARSER =================

function parseOptionChain(rows) {
    const parsed = [];

    rows.forEach(row => {
        // Skip header / junk rows
        if (!row.length || isNaN(row[0])) return;

        const len = row.length;
        const strikeIndex = Math.floor(len / 2);

        const strike = Number(row[strikeIndex]);

        // CALL side (left of strike)
        const ce_iv = Number(row[3]);
        const ce_oi = Number(
            (row[0] || "").toString().replace(/,/g, "")
        );

        // PUT side (right of strike)
        const pe_iv = Number(row[len - 4]);
        const pe_oi = Number(
            (row[len - 1] || "").toString().replace(/,/g, "")
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
