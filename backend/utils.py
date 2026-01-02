import csv
import io

CSV_HEADER = [
    "Date",
    "Symbol",
    "Spot",
    "ATM",
    "CE_IV",
    "PE_IV",
    "AVG_IV",
    "CE_OI",
    "PE_OI"
]

# ---------------- ATM ---------------- #

def calculate_atm(spot, strike_step):
    return int(round(float(spot) / strike_step) * strike_step)

# ---------------- ATM ROW EXTRACTION ---------------- #

def extract_atm_row(option_chain, atm_strike):
    """
    Robust ATM extractor:
    - Normalizes all strikes to int
    - Handles string / float mismatches
    - Falls back to nearest strike if exact match fails
    """

    atm_strike = int(atm_strike)

    strike_map = {}
    strikes = []

    for row in option_chain:
        try:
            strike = int(float(row["strike"]))
        except Exception:
            continue

        strike_map[strike] = {
            "ce_iv": float(row["ce_iv"]),
            "pe_iv": float(row["pe_iv"]),
            "ce_oi": int(row.get("ce_oi", 0)),
            "pe_oi": int(row.get("pe_oi", 0)),
        }
        strikes.append(strike)

    # ---- Exact match ----
    if atm_strike in strike_map:
        return strike_map[atm_strike]

    # ---- Nearest fallback (MANDATORY for NSE) ----
    if strikes:
        nearest = min(strikes, key=lambda x: abs(x - atm_strike))
        return strike_map[nearest]

    return None

# ---------------- CSV APPEND ---------------- #

def append_row_to_csv_text(csv_text, row):
    input_io = io.StringIO(csv_text.strip())
    reader = list(csv.reader(input_io))

    output = io.StringIO()
    writer = csv.writer(output)

    # Write header if missing
    if not reader or reader[0] != CSV_HEADER:
        writer.writerow(CSV_HEADER)
        writer.writerow(row)
        return output.getvalue()

    # Write existing data
    for r in reader:
        writer.writerow(r)

    writer.writerow(row)
    return output.getvalue()
