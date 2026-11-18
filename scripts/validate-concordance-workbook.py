#!/usr/bin/env python3
"""Compare the Concordance edition to the Navigation workbook and cumulative project records."""
import csv
import hashlib
import json
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EDITION = "docs/reprise-concordance-20261118.json"
FIELDS = ("lot", "priorite", "domaine", "etat", "prochaine_recette",
          "preuves_disponibles", "avance_ce_lot", "cloture")


def read(file):
    return json.loads((ROOT / file).read_text(encoding="utf-8"))


def main():
    load = runpy.run_path(str(ROOT / "scripts/validate-reprise-scenes-workbook.py"))["load"]
    delivery = read(EDITION)
    pointer = read("docs/current-delivery.json")
    base = ROOT / delivery["source_workbook"]
    assert hashlib.sha256(base.read_bytes()).hexdigest() == delivery["source_workbook_sha256"]
    previous = load(base)
    current = load(ROOT / delivery["output_workbook"])
    assert list(current) == [*previous, "Concordance"]
    summary_edits = {"A3", "A16", "A18", "A19", "A20", "A24"}
    for sheet in previous:
        if sheet == "Synthèse":
            assert previous[sheet].keys() == current[sheet].keys()
            for address, cell in previous[sheet].items():
                if address not in summary_edits:
                    assert current[sheet][address] == cell, (sheet, address)
        else:
            assert current[sheet] == previous[sheet], sheet

    registry = read(pointer["historical_registry"])["items"]
    keys = [item["cle"] for item in registry]
    assert len(keys) == len(set(keys)) == delivery["items"] == 600
    assert [current["Registre ouvert"][f"A{i}"][0] for i in range(6, 606)] == keys
    assert len(read(pointer["runtime_catalog"])) == delivery["runtime"] == 119

    boundary = pointer["workstream_updates"].index(EDITION) + 1
    if boundary == len(pointer["workstream_updates"]):
        for key in ("base_commit", "workstream_csv", "qa"):
            assert pointer[key] == delivery[key], key
        assert pointer["workbook"] == delivery["output_workbook"]
        assert pointer["tracked_keys"] == len(keys) and pointer["workstreams"] == 28
        assert pointer["runtime_count"] == delivery["runtime"]
    assert (ROOT / delivery["qa"]).is_file()
    rows = read("docs/chantiers-20261112.json")["work_packages"]
    for filename in pointer["workstream_updates"][:boundary]:
        updates = read(filename)["updates"]
        assert updates.keys() <= {r["lot"] for r in rows}
        for row in rows:
            row.update(updates.get(row["lot"], {}))
    with (ROOT / delivery["workstream_csv"]).open(encoding="utf-8-sig", newline="") as stream:
        csv_rows = list(csv.DictReader(stream, delimiter=";"))
    assert len(csv_rows) == len(rows) == 28
    sheet = current["Concordance"]
    for i, (row, csv_row) in enumerate(zip(rows, csv_rows), 6):
        row["avance_ce_lot"] = row["lot"] in delivery["updates"]
        assert row["cloture"] is False
        for column, key in zip("ABCDEFGH", FIELDS):
            value = row[key]
            assert csv_row[key] == str(value), (row["lot"], key)
            if isinstance(value, bool):
                value = "Oui" if value else "Non"
            assert sheet[column + str(i)][0] == value, (column, i)
    for column, number in (("G", len(delivery["updates"])), ("H", 0)):
        assert sheet[f"{column}36"] == (number, f'COUNTIF({column}6:{column}33,"Oui")')
    for i, (identifier, name, status, scenario) in enumerate(delivery["narration"], 39):
        assert f"DESIGN/Narration/{identifier}" in keys
        assert [sheet[f"{col}{i}"][0] for col in "ABCD"] == [identifier, status, name, scenario]
    assert {row[0]: row[2] for row in delivery["narration"]} == {
        "N07": "Partiel", "N08": "À produire", "N09": "À produire"
    }
    print(json.dumps({"result": "PASS", "sheets": len(current), "keys": len(keys),
                      "workstreams": len(rows), "advanced": len(delivery["updates"]), "closed": 0}))


if __name__ == "__main__":
    main()
