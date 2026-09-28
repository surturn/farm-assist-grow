"""Download external datasets into <data root>/external/_downloads, licence first.

    python fetch_datasets.py --licences          # show licence of every dataset, download nothing
    python fetch_datasets.py jmuben jmuben2 ...  # download named datasets (sha256-verified, resumable)

Non-commercial licences (NC) are refused unless --allow-noncommercial is given:
FarmAssist is a commercial product, and a model trained on NC data may not be
shippable. That decision belongs to a person, not this script.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from pipeline.sources import data_root

UA = {"User-Agent": "curl/8.0", "Accept": "application/json"}
API = "https://data.mendeley.com/public-api/datasets"

MENDELEY = {
    "jmuben": ("t2r6rszp5c", 1),
    "jmuben2": ("tgv3zb82nd", 1),
    "bracol": ("yy2k5y8mxg", 1),
    "rocole": ("c5yvn32dzg", 2),
    "mangoleafbd": ("hxsnvwty3r", 1),
    "chili": ("wzc6r6w5w5", 2),
}


def get_json(url: str):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))


def licence(name: str) -> tuple[str, str]:
    i, v = MENDELEY[name]
    d = get_json(f"{API}/{i}?version={v}")
    return d["name"], d["data_licence"]["short_name"]


def is_noncommercial(short: str) -> bool:
    return "NC" in short.upper().replace("-", " ").split()


def download(url: str, dest: Path, sha256: str | None) -> None:
    if dest.exists() and (sha256 is None or _sha(dest) == sha256):
        print(f"  have {dest.name}")
        return
    tmp = dest.with_suffix(dest.suffix + ".part")
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  get  {dest.name}", flush=True)
    for attempt in range(30):  # resume from .part on dropped connections
        have = tmp.stat().st_size if tmp.exists() else 0
        headers = {"User-Agent": "curl/8.0", **({"Range": f"bytes={have}-"} if have else {})}
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as r:
                mode = "ab" if have and r.status == 206 else "wb"
                with open(tmp, mode) as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
            break
        except (OSError, urllib.error.URLError) as e:
            print(f"  retry {attempt + 1} {dest.name}: {e}", flush=True)
            time.sleep(5)
    else:
        raise RuntimeError(f"gave up on {dest.name}")
    if sha256 and _sha(tmp) != sha256:
        tmp.unlink()
        raise RuntimeError(f"sha256 mismatch for {dest.name}")
    tmp.replace(dest)


def _sha(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


def fetch_mendeley(name: str, out: Path) -> None:
    i, v = MENDELEY[name]
    files = get_json(f"{API}/{i}/files?folder_id=root&version={v}")
    if not any(f["filename"].lower().endswith((".zip", ".rar", ".jpg", ".png")) for f in files):
        raise RuntimeError(f"{name}: images are in sub-folders the public API does not list; "
                           f"download manually from https://data.mendeley.com/datasets/{i}/{v}")
    for f in files:
        c = f["content_details"]
        download(c["download_url"], out / name / f["filename"], c.get("sha256_hash"))


def fetch_plantdoc_test(out: Path) -> None:
    """PlantDoc (CC BY 4.0) field images: only test/ is needed, and only as a field eval set."""
    repo = "pratikkayal/PlantDoc-Dataset"
    tree = get_json(f"https://api.github.com/repos/{repo}/git/trees/master?recursive=1")["tree"]
    files = [t["path"] for t in tree if t["type"] == "blob" and t["path"].startswith("test/")]
    print(f"plantdoc: {len(files)} test files")
    for p in files:
        folder, name = p.rsplit("/", 1)
        dest = out / "plantdoc" / folder / re.sub(r'[<>:"|?*]', "_", name)  # Windows-safe
        if not dest.exists():
            url = f"https://raw.githubusercontent.com/{repo}/master/" + urllib.request.quote(p)
            download(url, dest, None)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*")
    ap.add_argument("--licences", action="store_true")
    ap.add_argument("--allow-noncommercial", action="store_true")
    args = ap.parse_args()
    out = data_root() / "external" / "_downloads"

    if args.licences:
        for n in MENDELEY:
            title, short = licence(n)
            print(f"{n:<12} {short:<16} {'NON-COMMERCIAL' if is_noncommercial(short) else 'ok'}  {title[:70]}")
        return 0

    for n in args.names:
        if n == "plantdoc":
            fetch_plantdoc_test(out)
            continue
        title, short = licence(n)
        if is_noncommercial(short) and not args.allow_noncommercial:
            print(f"SKIP {n}: licence {short} is non-commercial (use --allow-noncommercial after a decision)")
            continue
        print(f"{n} ({short})")
        fetch_mendeley(n, out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
