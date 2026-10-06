"""Calibrate the near-duplicate hash on real data (not a unit test).

Positives: PlantVillage siblings sharing a UUID whose suffix is a pure flip or
90-degree rotation (same photo, same leaf).
Negatives: random same-class pairs with different UUIDs, and random same-class
CCMT pairs (different files; mostly different leaves).
Prints distance percentiles per hash size so the threshold is chosen from data.

    FARM_DATA_ROOT=... python tests/calibrate_hash.py
"""
import random
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.sources import SOURCES  # noqa: E402
from pipeline.split import list_images  # noqa: E402

DIHEDRAL = re.compile(r"_(180deg|90deg|270deg|flipTB|flipLR)$")


def hashes(path: Path, n: int) -> list[np.ndarray]:
    with Image.open(path) as im:
        im.draft("RGB", (256, 256))
        arr = np.asarray(im.convert("L").resize((128, 128), Image.Resampling.BILINEAR), dtype=np.float32)
    out = []
    for k in range(4):
        for v in (np.rot90(arr, k), np.fliplr(np.rot90(arr, k))):
            small = np.asarray(Image.fromarray(v).resize((n + 1, n), Image.Resampling.BILINEAR), dtype=np.float32)
            out.append((small[:, 1:] > small[:, :-1]).flatten())
    return out


def dist(a: list[np.ndarray], b: list[np.ndarray]) -> int:
    return min(int((a[0] != v).sum()) for v in b)


def main():
    rng = random.Random(0)
    pv = defaultdict(list)
    ccmt = defaultdict(list)
    for s in SOURCES:
        for p in list_images(s.path()):
            if s.grouping == "plantvillage_uuid":
                pv[s.label].append(p)
            elif s.source_id.startswith("ccmt"):
                ccmt[s.label].append(p)

    pos, neg_pv, neg_ccmt = [], [], []
    for label, ps in pv.items():
        by_uuid = defaultdict(list)
        for p in ps:
            by_uuid[p.stem.split("___")[0]].append(p)
        fams = [v for v in by_uuid.values() if len(v) > 1 and any(DIHEDRAL.search(x.stem) for x in v)]
        for fam in rng.sample(fams, min(40, len(fams))):
            orig = [x for x in fam if not re.search(r"_(180deg|90deg|270deg|flip\w+|new\w+)$", x.stem)]
            dih = [x for x in fam if DIHEDRAL.search(x.stem)]
            if orig and dih:
                pos.append((orig[0], dih[0]))
        uu = list(by_uuid)
        for _ in range(40):
            a, b = rng.sample(uu, 2)
            neg_pv.append((by_uuid[a][0], by_uuid[b][0]))
    for label, ps in ccmt.items():
        for _ in range(60):
            neg_ccmt.append(tuple(rng.sample(ps, 2)))

    for n in (8, 16):
        cache = {}
        h = lambda p: cache.setdefault(p, hashes(p, n))  # noqa: E731
        bits = n * n
        for name, pairs in (("positive (same photo, flipped)", pos), ("negative PV", neg_pv),
                            ("negative CCMT", neg_ccmt)):
            ds = []
            for a, b in pairs:
                try:
                    ds.append(dist(h(a), h(b)))
                except OSError:
                    pass  # corrupt file; build_split records and skips these
            d = np.array(ds)
            q = np.percentile(d, [0, 1, 5, 50, 95, 100]).astype(int)
            print(f"{bits:>3}-bit {name:<32} n={len(d):4d}  min/p1/p5/p50/p95/max = {list(q)}")
        print()


if __name__ == "__main__":
    main()
