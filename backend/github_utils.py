from flask import Flask, request, jsonify
from flask_cors import CORS
import os

from utils import (
    calculate_atm,
    extract_atm_row,
    append_row_to_csv_text
)

from github_utils import (
    get_csv_from_github,
    commit_csv_to_github
)

app = Flask(__name__)
CORS(app)

# ---------------- CONFIG ---------------- #

SYMBOL_FILE_MAP = {
    "NIFTY": "nifty_iv_log.csv",
    "BANKNIFTY": "banknifty_iv_log.csv"
}

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO")

if not GITHUB_TOKEN or not GITHUB_REPO:
    raise RuntimeError("GitHub environment variables not set")

# ---------------- ROUTES ---------------- #

@app.route("/process-option-chain", methods=["POST"])
def process_option_chain():
    data = request.get_json()

    # ---- Basic validation ----
    required_fields = ["symbol", "date", "spot", "strike_step", "option_chain"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    symbol = data["symbol"].upper()
    date = data["date"]
    spot = float(data["spot"])
    strike_step = int(data["strike_step"])
    option_chain = data["option_chain"]

    if symbol not in SYMBOL_FILE_MAP:
        return jsonify({"error": "Unsupported symbol"}), 400

    # ---- ATM calculation ----
    atm = calculate_atm(spot, strike_step)

    atm_row = extract_atm_row(option_chain, atm)
    if not atm_row:
        return jsonify({"error": "ATM strike not found in option chain"}), 400

    ce_iv = float(atm_row["ce_iv"])
    pe_iv = float(atm_row["pe_iv"])
    ce_oi = int(atm_row["ce_oi"])
    pe_oi = int(atm_row["pe_oi"])

    avg_iv = round((ce_iv + pe_iv) / 2, 2)

    # ---- Prepare CSV row ----
    row = [
        date,
        symbol,
        spot,
        atm,
        ce_iv,
        pe_iv,
        avg_iv,
        ce_oi,
        pe_oi
    ]

    # ---- GitHub CSV update ----
    csv_path = f"data/{SYMBOL_FILE_MAP[symbol]}"

    try:
        csv_text, sha = get_csv_from_github(
            GITHUB_REPO,
            csv_path,
            GITHUB_TOKEN
        )

        updated_csv = append_row_to_csv_text(csv_text, row)

        commit_csv_to_github(
            GITHUB_REPO,
            csv_path,
            GITHUB_TOKEN,
            updated_csv,
            sha,
            f"Add IV data for {symbol} {date}"
        )

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

    # ---- Success ----
    return jsonify({
        "status": "success",
        "message": "IV data saved and committed to GitHub",
        "data": {
            "date": date,
            "symbol": symbol,
            "spot": spot,
            "atm": atm,
            "avg_iv": avg_iv
        }
    })


# ---------------- MAIN ---------------- #

if __name__ == "__main__":
    app.run(debug=True)
