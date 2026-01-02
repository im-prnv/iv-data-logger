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

def calculate_atm(spot, strike_step):
    return int(round(float(spot) / strike_step) * strike_step)

def extract_valid_iv_row(option_chain, atm):
    """
    Returns the nearest strike to ATM
    where BOTH CE_IV and PE_IV exist.
    """

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

        candidates.append({
            "strike": strike,
            "ce_iv": float(ce_iv),
            "pe_iv": float(pe_iv),
            "ce_oi": int(row.get("ce_oi", 0)),
            "pe_oi": int(row.get("pe_oi", 0))
        })

    if not candidates:
        return None

    # Nearest valid strike
    return min(candidates, key=lambda x: abs(x["strike"] - atm))

def append_row_to_csv_text(csv_text, row):
    input_io = io.StringIO(csv_text.strip())
    reader = list(csv.reader(input_io))

    output = io.StringIO()
    writer = csv.writer(output)

    if not reader or reader[0] != CSV_HEADER:
        writer.writerow(CSV_HEADER)
        writer.writerow(row)
        return output.getvalue()

    for r in reader:
        writer.writerow(r)

    writer.writerow(row)
    return output.getvalue()
