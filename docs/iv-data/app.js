const BASE_RAW_URL =
  "https://raw.githubusercontent.com/im-prnv/iv-data-logger/main/data/";

const symbolSelect = document.getElementById("symbolSelect");
const downloadBtn = document.getElementById("downloadBtn");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const statusEl = document.getElementById("status");

symbolSelect.addEventListener("change", loadData);
downloadBtn.addEventListener("click", downloadCSV);

// initial load
loadData();

function loadData() {
  const symbol = symbolSelect.value;
  const file =
    symbol === "BANKNIFTY"
      ? "banknifty_iv_log.csv"
      : "nifty_iv_log.csv";

  const url = BASE_RAW_URL + file;

  statusEl.textContent = "Loading data...";

  Papa.parse(url, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: results => {
      if (!results.data || results.data.length === 0) {
        statusEl.textContent = "No data available";
        return;
      }

      renderTable(results.data);
      statusEl.textContent = `Loaded ${results.data.length} records`;
    },
    error: err => {
      console.error(err);
      statusEl.textContent = "Failed to load data";
    }
  });
}

function renderTable(rows) {
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  const columns = Object.keys(rows[0]);

  // header
  columns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col;
    tableHead.appendChild(th);
  });

  // rows
  rows.forEach(row => {
    const tr = document.createElement("tr");
    columns.forEach(col => {
      const td = document.createElement("td");
      td.textContent = row[col];
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
}

/* =========================
   FORCE CSV DOWNLOAD (FIX)
========================= */

async function downloadCSV() {
  const symbol = symbolSelect.value;
  const file =
    symbol === "BANKNIFTY"
      ? "banknifty_iv_log.csv"
      : "nifty_iv_log.csv";

  const url = BASE_RAW_URL + file;

  try {
    statusEl.textContent = "Preparing download...";

    const response = await fetch(url);
    if (!response.ok) {
      statusEl.textContent = "Download failed";
      return;
    }

    const csvText = await response.text();

    const blob = new Blob([csvText], { type: "text/csv" });
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = file;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    statusEl.textContent = "CSV downloaded";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Download failed";
  }
}
