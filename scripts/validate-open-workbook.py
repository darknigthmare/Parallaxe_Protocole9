#!/usr/bin/env python3
"""Contrôle structurel (lecture seule) des trois sources et du registre XLSX."""
from __future__ import annotations
import csv
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SOURCE = DOCS / "parallaxe-open-work-20261101.json"
EXCEL = DOCS / "PARALLAXE_Registre_Ouverts_2026-11-01_v2.xlsx"
INITIAL_XLSX = DOCS / "PARALLAXE_Registre_Ouverts_2026-11-01.xlsx"
NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
EXPECTED_SHEETS = ["Synthèse", "Lots prioritaires", "Registre ouvert", "Anomalies", "Recette QA", "Sources"]
ORIGINALS = [
    "PARALLAXE_Design_Complet.xlsx",
    "PARALLAXE_Suivi_Reprise_2026-10-28.xlsx",
    "PARALLAXE_Suivi_Sessions_2026-10-29.xlsx",
]


def assert_true(ok: bool, message: str) -> None:
    if not ok:
        raise AssertionError(message)


def inspect_xlsx(path: Path, min_rows: dict[str, int]) -> dict[str, int]:
    assert_true(path.is_file(), f"Classeur absent : {path}")
    with zipfile.ZipFile(path) as archive:
        assert_true(archive.testzip() is None, "CRC ZIP incorrect")
        members = set(archive.namelist())
        assert_true("[Content_Types].xml" in members, "Types de contenus absents")
        assert_true("xl/workbook.xml" in members, "workbook.xml absent")
        assert_true("xl/styles.xml" in members, "styles.xml absent")
        for name in members:
            if name.endswith((".xml", ".rels")):
                ET.fromstring(archive.read(name))
        book = ET.fromstring(archive.read("xl/workbook.xml"))
        actual = [node.attrib["name"] for node in book.findall("./x:sheets/x:sheet", NS)]
        assert_true(actual == EXPECTED_SHEETS, f"Onglets inattendus: {actual}")
        counts = {}
        for i, name in enumerate(actual, 1):
            sheet_path = f"xl/worksheets/sheet{i}.xml"
            assert_true(sheet_path in members, f"Feuille manquante : {name}")
            xml = ET.fromstring(archive.read(sheet_path))
            rows = xml.findall("./x:sheetData/x:row", NS)
            counts[name] = len(rows)
            assert_true(len(rows) == min_rows[name], f"Nombre de lignes incohérent: {name} {len(rows)}")
            assert_true(rows and len(rows[0].findall("x:c", NS)) > 1, f"En-tête manquant: {name}")
            if i > 1:
                assert_true(xml.find("x:autoFilter", NS) is not None, f"Filtre absent: {name}")
        summary = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        values = {}
        for cell in summary.findall("./x:sheetData/x:row/x:c", NS):
            address = cell.attrib.get("r")
            value = cell.find("x:v", NS)
            if value is not None:
                values[address] = value.text
        assert_true(values.get("B8") == "100", "Synthèse XLSX: 100 anomalies runtime attendues")
        assert_true(values.get("B9") == "20", "Synthèse XLSX: 20 anomalies non intégrées attendues")
        assert_true(values.get("B7") == "120", "Synthèse XLSX: 120 concepts attendus")
        return counts


def main() -> None:
    source = json.loads(SOURCE.read_text(encoding="utf8"))
    assert_true(source["schema"] == "parallaxe-open-work-v1", "Version de schéma incorrecte")
    assert_true(source["base_commit"] == "569bdedfab3a46f7753ac08c70651a2b399ff60d", "Base de reprise changée sans relecture")
    items = source["items"]
    lots = source["lots"]
    assert_true(len(items) == source["compteurs"]["items_total"] == 600, "Nombre d'items inattendu")
    assert_true(len(lots) == source["compteurs"]["lots_priorises"] == 28, "Nombre de lots inattendu")
    assert_true(len({x["cle"] for x in items}) == len(items), "Clé de suivi dupliquée")
    assert_true(len({x["id"] for x in lots}) == len(lots), "Lot dupliqué")
    assert_true(all(x.get("source", "").startswith("https://github.com/") for x in items), "Source manquante")
    assert_true(all(x.get("critere") and x.get("action") for x in items), "Action ou critère non renseigné")
    assert_true(all(x["statut_de_suivi"] == "Ouvert — non clôturé" for x in items), "Clôture non justifiée")
    domains = Counter(x["domaine"] for x in items)
    assert_true(domains["Anomalies"] == 120, "Les anomalies ne sont pas toutes présentes")
    assert_true(domains["QA"] == 124, "Le nombre de recettes QA ouvertes a changé")
    runtime = json.loads((DOCS / "runtime-catalog.json").read_text(encoding="utf8"))
    design = json.loads((DOCS / "anomalies-design.json").read_text(encoding="utf8"))
    runtime_ids = [item["id"] for item in runtime]
    design_ids = [item[0] for item in design["anomalies"]]
    assert_true(len(set(runtime_ids)) == len(runtime_ids), "ID runtime dupliqué")
    assert_true(len(set(design_ids)) == len(design_ids), "ID conception dupliqué")
    assert_true(set(runtime_ids).issubset(set(design_ids)), "Anomalie runtime sans fiche de conception")
    assert_true(len(runtime_ids) == source["compteurs"]["anomalies_runtime"] == 100, "100 anomalies runtime attendues")
    assert_true(len(design_ids) == 120 and len(design_ids)-len(runtime_ids) == source["compteurs"]["anomalies_non_implantees"] == 20, "20 concepts non implémentés attendus")
    tracked = {item["id"]: item for item in items if item["domaine"] == "Anomalies"}
    assert_true(set(tracked) == set(design_ids), "Registre d'anomalies non synchronisé")
    for ident in ("clock_stop_gaze", "carpet_wrong_weave", "coat_without_body", "fire_extinguisher_full"):
        assert_true(tracked[ident]["statut_source"] == "Implémenté — QA partielle", f"Statut non actualisé : {ident}")
    # The Excel-friendly CSV is not sufficient by itself: every authored A/B
    # source must remain verbatim in the new detailed technical backlog.
    backlog = json.loads((DOCS / "anomalies-gap-20261101.json").read_text(encoding="utf8"))
    gap = backlog["remaining_anomalies"]
    remaining_ids = set(design_ids) - set(runtime_ids)
    assert_true(len(gap) == backlog["remaining"] == 20, "20 fiches manquantes attendues")
    assert_true({item["id"] for item in gap} == remaining_ids, "Catalogue de la file d'attente incohérent")
    design_by_id = {row[0]: row for row in design["anomalies"]}
    for item in gap:
        row = design_by_id[item["id"]]
        for key, original_index in (
            ("name", 1), ("family", 2), ("place", 3), ("intensity", 4),
            ("baseline", 5), ("perceptionA", 6), ("perceptionB", 7),
            ("comparison", 8), ("trigger", 9), ("success", 10),
            ("assets", 11), ("fairness", 12),
        ):
            assert_true(item[key] == row[original_index], f"Source de conception altérée : {item['id']} / {key}")
        assert_true(item["status"] == "Conçu — non implémenté", f"Fausse validation de {item['id']}")
        assert_true(item["technicalImplementation"] and item["qaAcceptance"], f"Plan de recette vide : {item['id']}")
    with (DOCS / "ANOMALIES_RESTANTES_20261101.csv").open(encoding="utf-8-sig",newline="") as source_csv:
        parsed_csv = list(csv.DictReader(source_csv, delimiter=";"))
    assert_true(len(parsed_csv) == 20 and {line["ID"] for line in parsed_csv} == remaining_ids,
                "CSV Excel non synchronisé avec les 20 fiches restantes")
    for original in ORIGINALS:
        assert_true((DOCS / original).is_file(), f"Classeur historique absent: {original}")
    assert_true(INITIAL_XLSX.is_file(), "Première photographie Excel 96/24 manquante")
    assert_true(source["classeur_courant"] == "docs/" + EXCEL.name, "Chemin du classeur actuel incohérent")
    expected = {"Synthèse":18, "Lots prioritaires":29, "Registre ouvert":601, "Anomalies":121, "Recette QA":125, "Sources":14}
    rows = inspect_xlsx(EXCEL, expected)
    print(json.dumps({"result": "PASS - contrôle structurel seulement", "source":str(SOURCE.relative_to(ROOT)), "xlsx":str(EXCEL.relative_to(ROOT)), "rows":rows, "lots":len(lots), "items":len(items), "qa":domains["QA"], "anomalies":domains["Anomalies"], "limits":"Aucune recette GPU, micro, TURN ou formule recalculée en application Excel n'est revendiquée"},ensure_ascii=False))


if __name__ == "__main__":
    main()
