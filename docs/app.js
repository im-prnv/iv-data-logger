const BACKEND_URL = "https://YOUR-RENDER-URL/process-option-chain";

function processCSV() {
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

function parseOptionChain(rows) {
    /*
    EXPECTED CSV COLUMNS (typical NSE):
    STRIKE PRICE, CE IV, PE IV, CE OI, PE OI
    Adjust names here if needed
    */

    return rows.map(row => ({
        strike: Number(row["STRIKE PRICE"]),
        ce_iv: Number(row["CE IV"]),
        pe_iv: Number(row["PE IV"]),
        ce_oi: Number(row["CE OI"]),
        pe_oi: Number(row["PE OI"])
    })).filter(r => r.strike);
}

function parseOptionChain(rows) {
    const parsed = [];

    rows.forEach(row => {
        // Convert row object to array (order matters)
        const values = Object.values(row);

        // NSE CSV safety check
        if (values.length < 15) return;

        const strike = Number(values[values.length / 2 | 0]);

        // CALL side (left)
        const ce_iv = Number(values[3]);
        const ce_oi = Number(values[0].toString().replace(/,/g, ''));

        // PUT side (right)
        const pe_iv = Number(values[values.length - 4]);
        const pe_oi = Number(values[values.length - 1].toString().replace(/,/g, ''));

        if (!strike || isNaN(ce_iv) || isNaN(pe_iv)) return;

        parsed.push({
            strike: strike,
            ce_iv: ce_iv,
            pe_iv: pe_iv,
            ce_oi: ce_oi,
            pe_oi: pe_oi
        });
    });

    return parsed;
}
