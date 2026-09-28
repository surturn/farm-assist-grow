"""Hard gate before training. Exit 0 only if TRAIN_READY.

    python verify_split.py            # reads splits/v1/split_manifest.csv

Checks (each prints PASS/FAIL with evidence):
  G1 class manifest valid: frozen, every crop has Healthy, no maize/cassava
  G2 knowledge table == manifest classes; no severity; no dosages
  G3 no maize/cassava token in any row (path, source, label)
  G4 every row label is a manifest class (or OOD probe)
  G5 every group sits in exactly one split
  G6 no identical file (sha256) in two splits
  G7 no near-duplicate (any flip/90deg orientation) across splits
  G8 every class has >= MIN_TRAIN_GROUPS train groups and >= 1 val and test group
EVAL_READY additionally needs field sets (G9) for coffee, tomato, pepper, potato.
"""
from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

from pipeline.imagehash import DEFAULT_MAX_DISTANCE, near_duplicate_pairs
from pipeline.manifest import KNOWLEDGE_PATH, ManifestError, check_knowledge, crop_of, load_manifest

MIN_TRAIN_GROUPS = 50
FIELD_REQUIRED_CROPS = ("Coffee", "Tomato", "Pepper", "Potato")
SPLIT_DIR = Path(__file__).resolve().parent / "splits" / "v1"


def load_rows(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def run_checks(rows: list[dict], max_distance: int = DEFAULT_MAX_DISTANCE) -> dict:
    res: dict[str, tuple[bool, str]] = {}

    try:
        manifest = load_manifest()
        res["G1 manifest"] = (True, f"{manifest.version}: {len(manifest.classes)} classes, "
                                    f"{len(manifest.trained_crops)} crops, each with Healthy")
    except ManifestError as e:
        return {"G1 manifest": (False, str(e))}

    if KNOWLEDGE_PATH.exists():
        errs = check_knowledge(manifest, json.loads(KNOWLEDGE_PATH.read_text(encoding="utf-8")))
        res["G2 knowledge sync"] = (not errs, "; ".join(errs[:10]) or "exact match, no dosages, no severity")
    else:
        res["G2 knowledge sync"] = (False, f"{KNOWLEDGE_PATH} missing")

    bad = [r["path"] for r in rows if manifest.mentions_excluded(r["path"] + r["source_id"] + r["label"])]
    res["G3 no maize/cassava"] = (not bad, f"{len(bad)} contaminated rows" + (f", e.g. {bad[0]}" if bad else ""))

    classes = set(manifest.classes)
    bad = sorted({r["label"] for r in rows if r["label"] not in classes and not r["label"].startswith("OOD___")})
    res["G4 labels in manifest"] = (not bad, f"unknown labels: {bad}" if bad else f"{len(rows)} rows ok")

    live = [r for r in rows if r["split"] != "excluded"]
    splits_of_group: dict[str, set] = defaultdict(set)
    for r in live:
        splits_of_group[r["group"]].add(r["split"])
    multi = [g for g, s in splits_of_group.items() if len(s) > 1]
    res["G5 group in one split"] = (not multi, f"{len(splits_of_group)} groups; {len(multi)} span splits"
                                    + (f", e.g. {multi[0]}" if multi else ""))

    splits_of_sha: dict[str, set] = defaultdict(set)
    for r in live:
        splits_of_sha[r["sha256"]].add(r["split"])
    dup = [s for s, sp in splits_of_sha.items() if len(sp) > 1]
    res["G6 no identical file across splits"] = (not dup, f"{len(dup)} sha256 in >1 split")

    canonical = [int(r["dhash8"].split(";")[0], 16) for r in live]
    variants = [[int(h, 16) for h in r["dhash8"].split(";")] for r in live]
    pairs = near_duplicate_pairs(canonical, variants, max_distance)
    cross = [(live[a]["path"], live[a]["split"], live[b]["path"], live[b]["split"])
             for a, b in pairs if live[a]["split"] != live[b]["split"]]
    res["G7 no near-duplicate across splits"] = (not cross, f"{len(pairs)} near-dup pairs, {len(cross)} cross-split"
                                                 + (f", e.g. {cross[0]}" if cross else ""))

    groups = defaultdict(lambda: defaultdict(set))
    for r in live:
        groups[r["label"]][r["split"]].add(r["group"])
    thin = []
    for c in manifest.classes:
        g = groups.get(c, {})
        n_tr, n_va, n_te = len(g.get("train", ())), len(g.get("val", ())), len(g.get("test", ()))
        if n_tr < MIN_TRAIN_GROUPS or n_va < 1 or n_te < 1:
            thin.append(f"{c} (train {n_tr}, val {n_va}, test {n_te} groups)")
    res["G8 class coverage"] = (not thin, f"{len(thin)} classes short: " + "; ".join(thin) if thin
                                else f"all {len(manifest.classes)} classes >= {MIN_TRAIN_GROUPS} train groups")

    field_crops = {crop_of(r["label"]) for r in live if r["split"] == "field"}
    lacking = [c for c in FIELD_REQUIRED_CROPS if c not in field_crops]
    res["G9 field eval sets"] = (not lacking, f"no field test images for: {lacking}" if lacking
                                 else f"field sets present for {list(FIELD_REQUIRED_CROPS)}")
    return res


def main() -> int:
    csv_path = SPLIT_DIR / "split_manifest.csv"
    if not csv_path.exists():
        print(f"FAIL: {csv_path} not found. Run build_split.py first.")
        return 1
    rows = load_rows(csv_path)
    res = run_checks(rows)
    for name, (ok, detail) in res.items():
        print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")
    train_ready = all(ok for n, (ok, _) in res.items() if not n.startswith("G9"))
    eval_ready = train_ready and res.get("G9 field eval sets", (False, ""))[0]
    print(f"\nTRAIN_READY={train_ready}  EVAL_READY={eval_ready}")
    (SPLIT_DIR / "verify.json").write_text(json.dumps(
        {"train_ready": train_ready, "eval_ready": eval_ready,
         "checks": {n: {"pass": ok, "detail": d} for n, (ok, d) in res.items()}}, indent=2))
    return 0 if train_ready else 1


if __name__ == "__main__":
    sys.exit(main())
