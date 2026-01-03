const BASE_RAW_URL =
  "https://raw.githubusercontent.com/im-prnv/iv-data-logger/main/data/";

const chartCtx = document.getElementById("ivChart").getContext("2d");
let chartInstance = null;

document
  .getElementById("symbolSelect")
  .addEventListener("change", loadData);

// initial load
loadData();

function loadData() {
  const symbol = document.getElementById("symbolSelect").value;

  const file =
    symbol === "BANKNIFTY"
      ? "banknifty_iv_log.csv"
      : "nifty_iv_log.csv";

  const url = BASE_RAW_URL + file;

  Papa.parse(url, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: results => {
      if (!results.data || results.data.length === 0) {
        console.error("No data loaded from CSV");
        return;
      }

      const rows = results.data.filter(r => r.Date && r.AVG_IV && r.Spot);

      const dates = rows.map(r => r.Date);
      const iv = rows.map(r => Number(r.AVG_IV));
      const spot = rows.map(r => Number(r.Spot));

      const hv = calculateHV(spot, 20);

      renderChart(dates, iv, hv);
    },
    error: err => {
      console.error("CSV load error:", err);
    }
  });
}

function calculateHV(prices, period = 20) {
  const hv = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      hv.push(null);
      continue;
    }

    const returns = [];
    for (let j = i - period + 1; j <= i; j++) {
      const r = Math.log(prices[j] / prices[j - 1]);
      returns.push(r);
    }

    const mean =
      returns.reduce((a, b) => a + b, 0) / returns.length;

    const variance =
      returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
      returns.length;

    const stdDev = Math.sqrt(variance);
    const annualized = stdDev * Math.sqrt(252) * 100;

    hv.push(Number(annualized.toFixed(2)));
  }

  return hv;
}

function renderChart(dates, iv, hv) {
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(chartCtx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Implied Volatility (IV)",
          data: iv,
          borderColor: "#38bdf8",
          borderWidth: 2,
          tension: 0.3
        },
        {
          label: "Historical Volatility (HV)",
          data: hv,
          borderColor: "#f97316",
          borderWidth: 2,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#e5e7eb" }
        }
      },
      scales: {
        x: {
          ticks: { color: "#9ca3af" },
          grid: { color: "#1e293b" }
        },
        y: {
          ticks: { color: "#9ca3af" },
          grid: { color: "#1e293b" }
        }
      }
    }
  });
}
