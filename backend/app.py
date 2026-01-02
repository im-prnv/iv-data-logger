from flask import Flask, request, jsonify
from flask_cors import CORS
import os

from utils import (
    calculate_atm,
    extract_valid_iv_row,
    append_row_to_csv_text
)

from github_utils import (
    get_csv_from_github,
    commit_csv_to_github
)

app = Flask(__name__)
CORS(app)

SYMBOL_FILE_MAP = {
    "NIFTY": "nifty_iv_log.csv",
    "BANKNIFTY": "banknifty_iv_log.csv"
}

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO")

if not GITHUB_TOKEN or not GITHUB_REPO:
    raise RuntimeError("GitHub environment variables not set")

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/process-option-chain", methods=["POST"])
def process_option_chain():
    try:
        data = request.get_json()

        for f in ["symbol", "date", "spot", "strike_step", "option_chain"]:
            if f not in data:
                return jsonify({"error": f"Missing field: {f}"}), 400

        symbol = data["symbol"].upper()
        date = data["date"]
        spot = float(data["spot"])
        strike_step = int(data["strike_step"])
        option_chain = data["option_chain"]

        if symbol not in SYMBOL_FILE_MAP:
            return jsonify({"error": "Unsupported symbol"}), 400

        atm = calculate_atm(spot, strike_step)

        iv_row = extract_valid_iv_row(option_chain, atm)

        if not iv_row:
            return jsonify({
                "error": "No strike with valid CE & PE IV found",
                "atm": atm
            }), 400

        ce_iv = iv_row["ce_iv"]
        pe_iv = iv_row["pe_iv"]
        ce_oi = iv_row["ce_oi"]
        pe_oi = iv_row["pe_oi"]
        used_strike = iv_row["strike"]

        avg_iv = round((ce_iv + pe_iv) / 2, 2)

        row = [
            date,
            symbol,
            spot,
            used_strike,
            ce_iv,
            pe_iv,
            avg_iv,
            ce_oi,
            pe_oi
        ]

        csv_path = f"data/{SYMBOL_FILE_MAP[symbol]}"

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

        return jsonify({
            "status": "success",
            "data": {
                "date": date,
                "symbol": symbol,
                "spot": spot,
                "theoretical_atm": atm,
                "used_strike": used_strike,
                "avg_iv": avg_iv
            }
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
