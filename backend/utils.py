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
    "PE_OI",
    "IV_PERCENTILE",
    "IV_REGIME"
]

# ---------- ATM ----------

def calculate_atm(spot, strike_step):
    return int(round(float(spot) / strike_step) * strike_step)

# ---------- VALID IV STRIKE ----------

def extract_valid_iv_row(option_chain, atm):
    candidates = []

    for row in option_chain:
        try:
            strike = int(float(row["strike"]))
            ce_iv = row.get("ce_iv")
            pe_iv = row.get("pe_iv")
        except Exception:
            continue

        if ce_iv is None or pe_iv is None:
            continue

        try:
            ce_iv = float(ce_iv)
            pe_iv = float(pe_iv)
        except Exception:
            continue

        candidates.append({
            "strike": strike,
            "ce_iv": ce_iv,
            "pe_iv": pe_iv,
            "ce_oi": int(row.get("ce_oi", 0)),
            "pe_oi": int(row.get("pe_oi", 0))
        })

    if not candidates:
        return None

    return min(candidates, key=lambda x: abs(x["strike"] - atm))

# ---------- IV PERCENTILE & REGIME ----------

def calculate_iv_percentile(past_ivs, current_iv):
    if not past_ivs:
        return None
    below = sum(1 for iv in past_ivs if iv <= current_iv)
    return round((below / len(past_ivs)) * 100, 2)

def classify_iv_regime(p):
    if p is None:
        return "NA"
    if p >= 95:
        return "PANIC"
    if p >= 80:
        return "EXPANSION"
    if p >= 50:
        return "NORMAL_HIGH"
    if p >= 20:
        return "NORMAL_LOW"
    return "COMPRESSION"

# ---------- CSV WRITE (REPLACE MODE) ----------

def append_row_to_csv_text(csv_text, new_row):
    input_io = io.StringIO(csv_text.strip())
    reader = list(csv.reader(input_io))

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(CSV_HEADER)

    new_date = new_row[0]
    new_symbol = new_row[1]

    for r in reader[1:]:
        if len(r) >= 2 and r[0] == new_date and r[1] == new_symbol:
            continue
        writer.writerow(r)

    writer.writerow(new_row)
    return output.getvalue()
