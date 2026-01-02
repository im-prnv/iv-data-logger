from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import csv
import io

from utils import (
    calculate_atm,
    extract_valid_iv_row,
    calculate_iv_percentile,
    classify_iv_regime,
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

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/process-option-chain", methods=["POST"])
def process_option_chain():
    try:
        data = request.get_json()

        symbol = data["symbol"].upper()
        date = data["date"]
        spot = float(data["spot"])
        strike_step = int(data["strike_step"])
        option_chain = data["option_chain"]

        atm = calculate_atm(spot, strike_step)
        iv_row = extract_valid_iv_row(option_chain, atm)

        if not iv_row:
            return jsonify({"error": "No valid IV strike found"}), 400

        ce_iv = iv_row["ce_iv"]
        pe_iv = iv_row["pe_iv"]
        avg_iv = round((ce_iv + pe_iv) / 2, 2)

        # -------- Load past IVs --------
        csv_path = f"data/{SYMBOL_FILE_MAP[symbol]}"
        csv_text, sha = get_csv_from_github(
            GITHUB_REPO, csv_path, GITHUB_TOKEN
        )

        past_ivs = []
        reader = csv.DictReader(io.StringIO(csv_text))
        for r in reader:
            try:
                past_ivs.append(float(r["AVG_IV"]))
            except Exception:
                pass

        iv_percentile = calculate_iv_percentile(past_ivs[-30:], avg_iv)
        iv_regime = classify_iv_regime(iv_percentile)

        row = [
            date,
            symbol,
            spot,
            iv_row["strike"],
            ce_iv,
            pe_iv,
            avg_iv,
            iv_row["ce_oi"],
            iv_row["pe_oi"],
            iv_percentile,
            iv_regime
        ]

        updated_csv = append_row_to_csv_text(csv_text, row)

        commit_csv_to_github(
            GITHUB_REPO,
            csv_path,
            GITHUB_TOKEN,
            updated_csv,
            sha,
            f"IV update {symbol} {date}"
        )

        return jsonify({
            "status": "success",
            "avg_iv": avg_iv,
            "iv_percentile": iv_percentile,
            "iv_regime": iv_regime
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
