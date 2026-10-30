"""Validate the built ZIP and run real HTTP clients from a fresh extraction."""
import hashlib
import json
import pathlib
import stat
import subprocess
import tempfile
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
version = json.loads((root / "package.json").read_text())["version"]
output = root / "outputs" / f"release-v{version}"
report = json.loads((output / "release-manifest.json").read_text())
commit = subprocess.check_output(
    ["git", "rev-parse", "HEAD"], cwd=root, text=True
).strip()


def digest(data):
    return hashlib.sha256(data).hexdigest()


assert report["version"] == version
assert report["commit"] == commit
assert report["dirty"] is False, "The CI package must come from a clean checkout"
assert (output / "COMMIT.txt").read_text().strip() == commit

archives = {}
checksums = []
for kind in ("portable", "sources"):
    item = report[kind]
    archive_path = pathlib.Path(item["file"]).resolve()
    assert archive_path.parent == output.resolve(), "Archive outside the output folder"
    data = archive_path.read_bytes()
    assert len(data) == item["bytes"]
    assert digest(data) == item["sha256"]
    checksums.append(f'{item["sha256"]}  {archive_path.name}')
    with zipfile.ZipFile(archive_path) as archive:
        assert len(archive.infolist()) == item["files"]
        assert archive.testzip() is None, f"Corrupted {kind} ZIP"
    archives[kind] = archive_path

assert (output / "SHA256SUMS.txt").read_text().splitlines() == checksums

with tempfile.TemporaryDirectory(prefix="parallaxe-zip-") as temporary:
    extracted = pathlib.Path(temporary)
    with zipfile.ZipFile(archives["portable"]) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)), "Duplicate ZIP entries"
        for item in archive.infolist():
            archive_name = pathlib.PurePosixPath(item.filename)
            assert not archive_name.is_absolute()
            assert ".." not in archive_name.parts and "\\" not in item.filename
            assert not stat.S_ISLNK(item.external_attr >> 16)
            assert "node_modules" not in archive_name.parts
            assert ".parallaxe-data" not in archive_name.parts

        required = {
            "package.json", "COMMIT.txt", "LIRE_AVANT_DE_JOUER.txt",
            "LANCER_JEU_WINDOWS.cmd", "LANCER_COOP_RESEAU_WINDOWS.cmd",
            "lancer_jeu.sh", "lancer_coop_reseau.sh",
            "THIRD_PARTY_NOTICES.txt", "scripts/start-local.mjs",
            "standalone-dist/index.html",
        }
        required.update(
            f"standalone-dist/server/{name}.mjs"
            for name in ("levels", "catalog", "rules", "session", "radio-config")
        )
        assert required <= set(names), f"Missing files: {required - set(names)}"
        assert archive.read("COMMIT.txt").decode().strip() == commit
        assert json.loads(archive.read("package.json"))["version"] == version
        assert archive.read("scripts/start-local.mjs") == (
            root / "scripts/start-local.mjs"
        ).read_bytes()

        built = root / "standalone-dist"
        expected = {
            "standalone-dist/" + item.relative_to(built).as_posix(): item
            for item in built.rglob("*")
            if item.is_file() and not item.name.endswith(".zip")
        }
        actual = {
            name for name in names
            if name.startswith("standalone-dist/") and not name.endswith(".zip")
        }
        assert actual == set(expected), "The ZIP must contain the complete compiled build"
        for name, item in expected.items():
            assert archive.read(name) == item.read_bytes(), name

        embedded = "standalone-dist/downloads/" + archives["sources"].name
        assert archive.read(embedded) == archives["sources"].read_bytes()
        archive.extractall(extracted)

    subprocess.run(
        ["node", str(root / "tests/portable.test.mjs"),
         "--package-root", str(extracted)],
        cwd=root, check=True, timeout=90,
    )

print(json.dumps({
    "packagedArchive": "passed",
    "version": version,
    "commit": commit,
    "portableSha256": report["portable"]["sha256"],
    "checks": [
        "ZIP CRC and SHA256",
        "complete compiled build",
        "embedded source archive",
        "server with two clients and a four-player Chalet run launched from ZIP extraction",
    ],
    "webgl": "unverified",
    "windowsLauncher": "unverified",
}, indent=2))
