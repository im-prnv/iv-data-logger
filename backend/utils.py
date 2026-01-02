import csv
import io

# ================= CSV HEADER =================

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

# ================= ATM =================

def calculate_atm(spot, strike_step):
    """
    Calculate theoretical ATM based on spot and strike step
    """
    return int(round(float(spot) / strike_step) * strike_step)

# ================= VALID IV ROW SELECTION =================

def extract_valid_iv_row(option_chain, atm):
    """
    Returns the nearest strike to ATM
    where BOTH CE_IV and PE_IV exist.
    This avoids junk IV values and NoneType crashes.
    """

    candidates = []

    for row in option_chain:
        try:
            strike = int(float(row.get("strike")))
            ce_iv = row.get("ce_iv")
            pe_iv = row.get("pe_iv")
        except Exception:
            continue

        # Skip strikes with missing IV
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

    # Nearest strike to ATM
    return min(candidates, key=lambda x: abs(x["strike"] - atm))

# ================= CSV WRITE WITH DUPLICATE PROTECTION =================

def append_row_to_csv_text(csv_text, new_row):
    """
    Rewrites CSV:
    - Always keeps header
    - Replaces row if Date + Symbol already exist
    - Appends otherwise
    """

    input_io = io.StringIO(csv_text.strip())
    reader = list(csv.reader(input_io))

    output = io.StringIO()
    writer = csv.writer(output)

    # Always write header
    writer.writerow(CSV_HEADER)

    new_date = new_row[0]
    new_symbol = new_row[1]

    # Rewrite existing rows except same Date+Symbol
    for r in reader[1:]:
        if len(r) >= 2 and r[0] == new_date and r[1] == new_symbol:
            continue
        writer.writerow(r)

    # Write latest row
    writer.writerow(new_row)

    return output.getvalue()
