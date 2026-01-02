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
    input_io = io.StringIO(csv_text)
    reader = list(csv.reader(input_io))

    # If file is empty
    if not reader:
        reader = [CSV_HEADER]

    header = reader[0]
    rows = reader[1:]

    rows.append(row)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(header)
    writer.writerows(rows)

    return output.getvalue()
