"""Build the grouped v1 split manifest. Reads images; writes no image files.

    FARM_DATA_ROOT=<dir holding the datasets>  python build_split.py

Outputs (AImodel/splits/v1/):
  split_manifest.csv   one row per image: path, label, group, split, hashes...
  summary.json         per-class image/group counts per split, sources found and
                       missing, conflicts, cross-label near-duplicates
  hash-cache.json      speeds up re-runs (keyed by path, size, mtime)
Then run verify_split.py. Training must not start unless it passes.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from pipeline.imagehash import DEFAULT_MAX_DISTANCE, HASH_BITS, image_hashes, sha256_file
from pipeline.manifest import load_manifest
from pipeline.sources import SOURCES, data_root
from pipeline.split import (Record, assign_groups, assign_splits, base_group_key, drop_exact_conflicts,
                            is_derived, list_images, resolve_cross_label)

OUT_DIR = Path(__file__).resolve().parent / "splits" / "v1"
CSV_FIELDS = ["path", "source_id", "origin", "kind", "role", "label", "split", "group", "derived",
              "sha256", "dhash8", "notes"]


def _hash_one(path_str: str) -> tuple[str, str, list[int] | None, str]:
    p = Path(path_str)
    sha = sha256_file(p)
    try:
        return path_str, sha, image_hashes(p), ""
    except Exception as e:  # corrupt/truncated file: record it, never train on it
        return path_str, sha, None, f"{type(e).__name__}: {e}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--max-distance", type=int, default=DEFAULT_MAX_DISTANCE,
                    help="256-bit dHash distance treated as the same image (calibrated, see pipeline/imagehash.py)")
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    args = ap.parse_args()

    manifest = load_manifest()
    root = data_root()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"data root: {root}\nmanifest:  {manifest.version} ({len(manifest.classes)} classes)")

    # 1. Enumerate registered sources only. Nothing unregistered is ever read.
    found, missing, files = [], [], []
    for s in SOURCES:
        if manifest.mentions_excluded(s.source_id + s.rel_path + s.label):
            raise SystemExit(f"registry contains excluded crop: {s.source_id}")
        imgs = list_images(s.path())
        (found if imgs else missing).append({"source_id": s.source_id, "path": s.rel_path, "label": s.label,
                                              "role": s.role, "images": len(imgs), "acquire": s.acquire})
        files.extend((s, p) for p in imgs)
    print(f"sources: {len(found)} present, {len(missing)} missing; {len(files)} images")

    # 2. Hash (cached).
    cache_path = OUT_DIR / "hash-cache.json"
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    todo, results = [], {}
    for _, p in files:
        st = p.stat()
        key = f"dhash{HASH_BITS}|{p}|{st.st_size}|{int(st.st_mtime)}"  # hash change invalidates cache
        if key in cache:
            results[str(p)] = cache[key]
        else:
            todo.append((key, str(p)))
    if todo:
        print(f"hashing {len(todo)} images with {args.workers} workers...")
        keys = dict((ps, k) for k, ps in todo)
        with ProcessPoolExecutor(args.workers) as ex:
            for i, (ps, sha, hs, err) in enumerate(ex.map(_hash_one, [ps for _, ps in todo], chunksize=64), 1):
                results[ps] = cache[keys[ps]] = {"sha256": sha, "hashes": hs, "error": err}
                if i % 5000 == 0:
                    print(f"  {i}/{len(todo)}")
        cache_path.write_text(json.dumps(cache))

    records, unreadable = [], []
    for s, p in files:
        h = results[str(p)]
        if h.get("hashes") is None:
            unreadable.append({"path": str(p.relative_to(root)).replace("\\", "/"), "error": h.get("error")})
            continue
        records.append(Record(path=str(p.relative_to(root)).replace("\\", "/"), source_id=s.source_id,
                              origin=s.origin, kind=s.kind, role=s.role, label=s.label, sha256=h["sha256"],
                              hashes=h["hashes"], base_group=base_group_key(s.source_id, s.grouping, p),
                              derived=is_derived(s.grouping, p)))

    # 3. Label conflicts, groups, splits.
    records, conflicts = drop_exact_conflicts(records)
    gstats = assign_groups(records, args.max_distance)
    assign_splits(records, seed=args.seed)
    resolve_cross_label(records, gstats["cross_label_near_dups"])

    # 4. Write manifest.
    with open(OUT_DIR / "split_manifest.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        for r in sorted(records, key=lambda r: (r.label, r.split, r.group, r.path)):
            w.writerow({"path": r.path, "source_id": r.source_id, "origin": r.origin, "kind": r.kind,
                        "role": r.role, "label": r.label, "split": r.split, "group": r.group,
                        "derived": int(r.derived), "sha256": r.sha256,
                        "dhash8": ";".join(f"{h:064x}" for h in r.hashes), "notes": " | ".join(r.notes)})

    # 5. Summary.
    per_class: dict[str, dict] = {}
    for label in list(manifest.classes) + sorted({r.label for r in records if r.role == "ood"}):
        rows = [r for r in records if r.label == label]
        entry = {}
        for sp in ("train", "val", "test", "field", "ood", "excluded"):
            rs = [r for r in rows if r.split == sp]
            if rs:
                entry[sp] = {"images": len(rs), "groups": len({r.group for r in rs}),
                             "scored_images": len([r for r in rs if not r.derived])}
        entry["origins"] = sorted({r.origin for r in rows})
        per_class[label] = entry
    summary = {
        "manifest_version": manifest.version, "seed": args.seed, "max_distance": args.max_distance,
        "data_root": str(root), "images": len(records),
        "sources_present": found, "sources_missing": missing,
        "classes_without_data": [c for c in manifest.classes if not per_class[c].get("train")],
        "unreadable_images_skipped": unreadable,
        "exact_label_conflicts_dropped": conflicts,
        "near_duplicate_pairs": gstats["near_dup_pairs"],
        "largest_group": gstats["largest_group"],
        "cross_label_near_duplicates": {"count": len(gstats["cross_label_near_dups"]),
                                        "sample": gstats["cross_label_near_dups"][:50]},
        "per_class": per_class,
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2))
    print(f"wrote {OUT_DIR / 'split_manifest.csv'} and summary.json")
    print(f"label conflicts dropped: {len(conflicts)}; cross-label near-dups: {len(gstats['cross_label_near_dups'])}")
    print(f"classes without training data: {len(summary['classes_without_data'])}")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
