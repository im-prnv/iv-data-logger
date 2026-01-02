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
    return round(spot / strike_step) * strike_step


def extract_atm_row(option_chain, atm_strike):
    for row in option_chain:
        if int(row["strike"]) == int(atm_strike):
            return row
    return None


def append_row_to_csv_text(csv_text, row):
    input_io = io.StringIO(csv_text.strip())
    reader = list(csv.reader(input_io))

    output = io.StringIO()
    writer = csv.writer(output)

    # Case 1: Empty file OR file without header
    if not reader or reader[0] != CSV_HEADER:
        writer.writerow(CSV_HEADER)
        writer.writerow(row)
        return output.getvalue()

    # Case 2: Proper file exists
    writer.writerow(reader[0])      # header
    for r in reader[1:]:
        writer.writerow(r)

    writer.writerow(row)

    return output.getvalue()
