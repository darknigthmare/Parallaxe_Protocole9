#!/usr/bin/env python3
"""Contrôle structurel (lecture seule) des trois sources et du registre XLSX."""
from __future__ import annotations
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
EXCEL = DOCS / "PARALLAXE_Registre_Ouverts_2026-11-01.xlsx"
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
    assert_true(source["compteurs"]["anomalies_runtime"] == 96, "Écart avec le runtime d'origine")
    assert_true(source["compteurs"]["anomalies_non_implantees"] == 24, "24 anomalies à traiter attendues")
    for original in ORIGINALS:
        assert_true((DOCS / original).is_file(), f"Classeur historique absent: {original}")
    expected = {"Synthèse":17, "Lots prioritaires":29, "Registre ouvert":601, "Anomalies":121, "Recette QA":125, "Sources":13}
    rows = inspect_xlsx(EXCEL, expected)
    print(json.dumps({"result": "PASS - contrôle structurel seulement", "source":str(SOURCE.relative_to(ROOT)), "xlsx":str(EXCEL.relative_to(ROOT)), "rows":rows, "lots":len(lots), "items":len(items), "qa":domains["QA"], "anomalies":domains["Anomalies"], "limits":"Aucune recette GPU, micro, TURN ou formule recalculée en application Excel n'est revendiquée"},ensure_ascii=False))


if __name__ == "__main__":
    main()
