"""Lay out the verified split for ultralytics, then augment TRAIN only.

    python materialize.py [--augment-copies 1] [--masks <dir>] [--backgrounds <dir>]

Refuses to run unless verify_split.py reports TRAIN_READY. Hard-links images
(no copy; same volume) into:
  <data root>/KenyaCropDisease_v2/{train,val,test}/<label>/
  <data root>/KenyaCropDisease_v2_field/<origin>/<label>/     (field eval only)
Source-side augmented copies (PlantVillage flips) go to train only; val/test
get one scored image per original photo.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import sys
from pathlib import Path

from pipeline.augment import AugConfig, augment_train_split
from pipeline.sources import data_root
from verify_split import SPLIT_DIR, load_rows, run_checks


def link(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        return
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--augment-copies", type=int, default=1)
    ap.add_argument("--masks", type=Path, help="dir of PlantVillage segmented images, same file names")
    ap.add_argument("--backgrounds", type=Path, help="dir of farm background photos")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rows = load_rows(SPLIT_DIR / "split_manifest.csv")
    res = run_checks(rows)
    failed = [n for n, (ok, _) in res.items() if not ok and not n.startswith("G9")]
    if failed:
        print("refusing to materialize; verify_split.py failures: " + ", ".join(failed))
        return 1

    root = data_root()
    out = root / "KenyaCropDisease_v2"
    field_out = root / "KenyaCropDisease_v2_field"
    for d in (out, field_out):
        if d.exists():
            shutil.rmtree(d)

    train_rows = []
    counts: dict[str, int] = {}
    for r in rows:
        sp, src = r["split"], root / r["path"]
        derived = r["derived"] == "1"
        name = f"{r['source_id'].replace('/', '_')}__{Path(r['path']).name}"
        if sp == "train":
            link(src, out / "train" / r["label"] / name)
            train_rows.append({**r, "path": str(src), "derived": derived})
        elif sp in ("val", "test") and not derived:
            link(src, out / sp / r["label"] / name)
        elif sp in ("field", "ood"):
            link(src, field_out / r["origin"].split(" (")[0] / r["label"] / name)
        else:
            continue
        counts[sp] = counts.get(sp, 0) + 1

    mask_for = None
    if args.masks:
        def mask_for(p: Path):
            m = args.masks / p.name
            return m if m.exists() else None
    backgrounds = sorted(args.backgrounds.glob("*.jpg")) if args.backgrounds else None
    aug = augment_train_split(train_rows, out, AugConfig(copies_per_image=args.augment_copies),
                              seed=args.seed, mask_for=mask_for, backgrounds=backgrounds)

    with open(SPLIT_DIR / "augment_manifest.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["path", "source_path", "label", "group", "split", "ops"])
        w.writeheader()
        w.writerows(aug["written"])
    report = {"linked": counts, "augmented_train_images": len(aug["written"]),
              "background_replacement_skipped_no_mask": aug["background_skipped_no_mask"]}
    (SPLIT_DIR / "materialize.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
