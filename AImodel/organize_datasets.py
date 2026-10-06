"""Unpack downloaded archives into the folder layout pipeline/sources.py expects.

    python organize_datasets.py [name ...]      # default: every dataset whose download is present

Reads <data root>/external/_downloads/, writes <data root>/external/<Dataset>/<folder>/.
Only images are extracted. Source splits (train/val/test) are pooled, because
build_split.py makes its own grouped split; file names are prefixed with the
source split so they cannot collide. Re-running skips files already present.
"""
from __future__ import annotations

import shutil
import sys
import zipfile
from pathlib import Path

from pipeline.sources import data_root

IMAGE_EXTS = (".jpg", ".jpeg", ".png")


def _extract(zip_path: Path, dest_for) -> int:
    """dest_for(member_name) -> destination Path or None (skip)."""
    n = 0
    with zipfile.ZipFile(zip_path) as z:
        for m in z.infolist():
            if m.is_dir() or not m.filename.lower().endswith(IMAGE_EXTS):
                continue
            dest = dest_for(m.filename)
            if dest is None or dest.exists():
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            with z.open(m) as src, open(dest, "wb") as out:
                shutil.copyfileobj(src, out)
            n += 1
    return n


def ibean(dl: Path, ext: Path) -> int:
    n = 0
    for split in ("train", "validation", "test"):
        def dest(name, split=split):
            parts = name.split("/")
            return ext / "iBean" / parts[-2] / f"{split}_{parts[-1]}" if len(parts) >= 2 else None
        n += _extract(dl / "ibean_hf" / f"{split}.zip", dest)
    return n


def tzbean(dl: Path, ext: Path) -> int:
    n = 0
    for zname, folder in (("anthra", "anthracnose"), ("healthy", "healthy"), ("rust", "rust")):
        n += _extract(dl / "tzbean" / f"{zname}.zip",
                      lambda name, folder=folder: ext / "TanzaniaBean" / folder / name.replace("/", "_"))
    return n


def jmuben(dl: Path, ext: Path) -> int:
    # One zip per class; zip name prefix -> sources.py folder.
    folders = {"Cerscospora": "Cerscospora", "Leaf rust": "Rust", "Phoma": "Phoma", "Miner": "Miner",
               "Healthy": "Healthy"}
    n = 0
    for sub in ("jmuben", "jmuben2"):
        for z in sorted((dl / sub).glob("*.zip")):
            folder = next((v for k, v in folders.items() if z.name.startswith(k)), None)
            if folder is None:
                print(f"  unknown JMuBEN archive {z.name}; skipped")
                continue
            n += _extract(z, lambda name, folder=folder: ext / "JMuBEN" / folder / name.replace("/", "_"))
    return n


def plantdoc(dl: Path, ext: Path) -> int:
    src = dl / "plantdoc" / "test"
    n = 0
    for f in src.rglob("*"):
        if f.is_file() and f.suffix.lower() in IMAGE_EXTS:
            dest = ext / "PlantDoc" / "test" / f.parent.name / f.name
            if not dest.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dest)
                n += 1
    return n


ORGANIZERS = {"ibean": ibean, "tzbean": tzbean, "jmuben": jmuben, "plantdoc": plantdoc}


def main() -> int:
    dl = data_root() / "external" / "_downloads"
    ext = data_root() / "external"
    names = sys.argv[1:] or list(ORGANIZERS)
    for name in names:
        try:
            print(f"{name}: {ORGANIZERS[name](dl, ext)} images extracted")
        except FileNotFoundError as e:
            print(f"{name}: download missing ({e.filename})")
        except zipfile.BadZipFile as e:
            print(f"{name}: archive incomplete or corrupt ({e}); re-run after download finishes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
