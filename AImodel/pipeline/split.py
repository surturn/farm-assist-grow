"""Grouped split: groups, never files, are assigned to train/val/test.

Group key, finest provable unit first:
  1. PlantVillage: UUID prefix before '___' (one original photo; the source's
     own flips/rotations/colour variants share it).
  2. Everything else: the file itself.
  3. Then union any two images of the same class that are near-duplicates in
     any flip/90-degree orientation (same leaf re-shot, burst frames, copies).

No source on disk publishes farm, session or plant IDs. When one does (field
collection), add a grouping mode here that uses it; it is strictly better.
"""
from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from .imagehash import UnionFind, near_duplicate_pairs

SPLITS = ("train", "val", "test")
RATIOS = (0.8, 0.1, 0.1)
PV_DERIVED_RE = re.compile(r"_(180deg|90deg|270deg|flipTB|flipLR|new[A-Za-z0-9]+)$")
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}


@dataclass
class Record:
    path: str
    source_id: str
    origin: str
    kind: str
    role: str
    label: str
    sha256: str
    hashes: list[int]
    base_group: str
    derived: bool = False
    group: str = ""
    split: str = ""
    notes: list[str] = field(default_factory=list)


def base_group_key(source_id: str, grouping: str, path: Path) -> str:
    stem = path.stem
    if grouping == "plantvillage_uuid":
        if "___" in stem:
            return "pv:" + stem.split("___", 1)[0].lower()
        return f"pv-file:{stem.lower()}"
    if grouping == "file":
        return f"{source_id}:{stem.lower()}"
    raise ValueError(f"unknown grouping {grouping}")


def is_derived(grouping: str, path: Path) -> bool:
    """True for a source-side augmented copy (PlantVillage suffixes)."""
    return grouping == "plantvillage_uuid" and bool(PV_DERIVED_RE.search(path.stem))


def list_images(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS)


def drop_exact_conflicts(records: list[Record]) -> tuple[list[Record], list[dict]]:
    """Identical bytes under two different labels: the label is unknowable. Drop all copies."""
    labels_by_sha: dict[str, set[str]] = defaultdict(set)
    for r in records:
        labels_by_sha[r.sha256].add(r.label)
    bad = {sha for sha, labels in labels_by_sha.items() if len(labels) > 1}
    conflicts = [{"sha256": sha, "labels": sorted(labels_by_sha[sha]),
                  "paths": sorted(r.path for r in records if r.sha256 == sha)} for sha in sorted(bad)]
    return [r for r in records if r.sha256 not in bad], conflicts


def assign_groups(records: list[Record], max_distance: int) -> dict:
    """Set r.group. Returns stats, including cross-label near-duplicates for review."""
    uf = UnionFind(len(records))
    first_by_key: dict[str, int] = {}
    first_by_sha: dict[str, int] = {}
    for i, r in enumerate(records):
        for table, key in ((first_by_key, r.base_group), (first_by_sha, r.sha256)):
            if key in table:
                uf.union(table[key], i)
            else:
                table[key] = i

    canonical = [r.hashes[0] for r in records]
    variants = [r.hashes for r in records]
    pairs = near_duplicate_pairs(canonical, variants, max_distance)
    cross_label = []
    for a, b in pairs:
        if records[a].label == records[b].label:
            uf.union(a, b)
        else:
            cross_label.append((records[a].path, records[a].label, records[b].path, records[b].label))

    for i, r in enumerate(records):
        root = records[uf.find(i)]
        r.group = f"{root.label}|{root.base_group}"
    sizes: dict[str, int] = defaultdict(int)
    for r in records:
        sizes[r.group] += 1
    return {"near_dup_pairs": len(pairs), "cross_label_near_dups": sorted(cross_label),
            "largest_group": max(sizes.values()) if sizes else 0}


def _rank(seed: int, group: str) -> str:
    return hashlib.sha256(f"{seed}:{group}".encode()).hexdigest()


def assign_splits(records: list[Record], seed: int = 42) -> None:
    """Per class, order groups by a seeded hash and cut 80/10/10 by group count.

    Deterministic: the same inputs and seed always give the same split, and a
    group's split only changes if the group itself changes.
    Only role='pool' records are split; 'field' -> 'field', 'ood' -> 'ood'.
    """
    groups_by_label: dict[str, set[str]] = defaultdict(set)
    for r in records:
        if r.role == "pool":
            groups_by_label[r.label].add(r.group)
    split_of: dict[str, str] = {}
    for label, groups in groups_by_label.items():
        ordered = sorted(groups, key=lambda g: _rank(seed, g))
        n = len(ordered)
        n_test = max(1, round(n * RATIOS[2])) if n >= 3 else 0
        n_val = max(1, round(n * RATIOS[1])) if n >= 3 else 0
        for idx, g in enumerate(ordered):
            split_of[g] = "test" if idx < n_test else "val" if idx < n_test + n_val else "train"
    for r in records:
        if r.role == "pool":
            r.split = split_of[r.group]
        elif r.group in split_of:
            # A field/OOD image that near-duplicates a trainable image would be
            # scored on something the model trained on. Keep it out of eval.
            r.split = "excluded"
            r.notes.append(f"near-duplicate of pool group ({split_of[r.group]})")
        else:
            r.split = r.role


def resolve_cross_label(records: list[Record], cross_pairs: list[tuple[str, str, str, str]]) -> None:
    """Call after assign_splits. A cross-label near-duplicate is either one leaf
    under two labels (label unknowable) or a hash coincidence; either way it must
    not straddle a split boundary, and summary.json lists it for review.
      pool + pool        -> both excluded
      field/ood + pool   -> the evaluation image excluded
    """
    by_path = {r.path: r for r in records}
    for pa, _, pb, _ in cross_pairs:
        a, b = by_path[pa], by_path[pb]
        if a.role == "pool" and b.role == "pool":
            for x, y in ((a, b), (b, a)):
                x.split = "excluded"
                x.notes.append(f"cross-label near-duplicate of {y.path} ({y.label}); review")
            continue
        for x, y in ((a, b), (b, a)):
            if x.role != "pool" and y.role == "pool" and x.split != "excluded":
                x.split = "excluded"
                x.notes.append(f"near-duplicate of pool image with label {y.label}")


def eval_view(records: list[Record]) -> list[Record]:
    """Rows actually used for val/test scoring: source-side augmented copies removed,
    so a flipped duplicate cannot be scored twice."""
    return [r for r in records if r.split in ("val", "test", "field", "ood") and not r.derived]
