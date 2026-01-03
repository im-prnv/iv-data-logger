const BACKEND_BASE = "https://iv-data-logger.onrender.com";
const HEALTH_URL = `${BACKEND_BASE}/health`;

const backendEl = document.getElementById("backendStatus");

async function checkBackend() {
  try {
    backendEl.textContent = "Backend: Waking";
    backendEl.className = "status-wake";

    const r = await fetch(HEALTH_URL, { cache: "no-store" });
    if (r.ok) {
      backendEl.textContent = "Backend: Active";
      backendEl.className = "status-live";
    }
  } catch {
    backendEl.textContent = "Backend: Sleeping";
    backendEl.className = "status-sleep";
  }
}

window.addEventListener("load", checkBackend);
