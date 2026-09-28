"""Phase 1 pipeline tests. Stdlib unittest; no dataset needed.

    cd AImodel && venv/Scripts/python -m unittest discover -s tests -v
"""
from __future__ import annotations

import copy
import json
import random
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import abstention, metrics  # noqa: E402
from pipeline.augment import AugConfig, SplitLeakError, augment_train_split  # noqa: E402
from pipeline.imagehash import DEFAULT_MAX_DISTANCE, dihedral_dhashes, hamming, near_duplicate_pairs  # noqa: E402
from pipeline.manifest import (KNOWLEDGE_PATH, MANIFEST_PATH, ManifestError, check_knowledge,  # noqa: E402
                               check_model_classes, load_manifest, validate_manifest)
from pipeline.sources import SOURCES  # noqa: E402
from pipeline.split import (Record, assign_groups, assign_splits, base_group_key,  # noqa: E402
                            drop_exact_conflicts, is_derived, resolve_cross_label)
from verify_split import run_checks  # noqa: E402

CASES = json.loads((MANIFEST_PATH.parent / "abstention-cases.json").read_text(encoding="utf-8"))["cases"]


def leaf(seed: int, size: int = 128) -> Image.Image:
    """Synthetic 'leaf': smooth random blobs, distinct per seed."""
    rng = np.random.default_rng(seed)
    small = rng.integers(0, 255, (8, 8, 3), dtype=np.uint8)
    return Image.fromarray(small).resize((size, size), Image.Resampling.BICUBIC)


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.m = load_manifest()
        self.raw = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    def test_frozen_v1_list(self):
        self.assertEqual(len(self.m.classes), 33)
        for crop in self.m.trained_crops:
            self.assertIn(f"{crop}___Healthy", self.m.classes, crop)

    def test_tomato_required_classes(self):
        for d in ("Healthy", "Early_Blight", "Septoria_Leaf_Spot", "Target_Spot", "Mosaic_Virus"):
            self.assertIn(f"Tomato___{d}", self.m.classes)

    def test_no_maize_or_cassava(self):
        for c in self.m.classes:
            self.assertFalse(self.m.mentions_excluded(c), c)

    def test_untrained_scope_not_classes(self):
        self.assertIn("Avocado", self.m.not_trained_crops)
        self.assertIn("Mango___Cercospora", self.m.not_trained_labels)
        self.assertNotIn("Mango___Cercospora", self.m.classes)

    def test_rejects_crop_without_healthy(self):
        raw = copy.deepcopy(self.raw)
        raw["classes"].remove("Bean___Healthy")
        with self.assertRaisesRegex(ManifestError, "Bean has no Healthy"):
            validate_manifest(raw)

    def test_rejects_excluded_class(self):
        raw = copy.deepcopy(self.raw)
        raw["classes"].append("Maize___Common_Rust")
        raw["trainedCrops"].append("Maize")
        with self.assertRaisesRegex(ManifestError, "excluded crop"):
            validate_manifest(raw)

    def test_model_class_check(self):
        self.assertEqual(check_model_classes(self.m, list(self.m.classes)), [])
        self.assertTrue(check_model_classes(self.m, list(self.m.classes[:-1]) + ["Maize___Healthy"]))


class KnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.m = load_manifest()
        self.k = json.loads(KNOWLEDGE_PATH.read_text(encoding="utf-8"))

    def test_real_table_in_sync(self):
        self.assertEqual(check_knowledge(self.m, self.k), [])

    def test_every_entry_unreviewed(self):
        self.assertTrue(all(e["reviewed"] is False for e in self.k.values()))

    def test_detects_missing_extra_severity_dosage(self):
        k = copy.deepcopy(self.k)
        del k["Coffee___Rust"]
        k["Maize___Common_Rust"] = k["Coffee___Phoma"]
        k["Tomato___Leaf_Mold"]["severity"] = "Severe"
        k["Tomato___Late_Blight"]["treatment"] = "Spray mancozeb at 50 g per 20 litres."
        errs = "\n".join(check_knowledge(self.m, k))
        self.assertIn("missing class Coffee___Rust", errs)
        self.assertIn("non-class Maize___Common_Rust", errs)
        self.assertIn("Tomato___Leaf_Mold: severity", errs)
        self.assertIn("Tomato___Late_Blight: looks like a dosage", errs)


class SourceRegistryTests(unittest.TestCase):
    def test_no_excluded_sources(self):
        m = load_manifest()
        for s in SOURCES:
            self.assertFalse(m.mentions_excluded(s.source_id + s.rel_path + s.label), s.source_id)
            self.assertNotIn("PlantDoc1", s.rel_path)

    def test_unprovable_ccmt_mappings_absent(self):
        paths = [s.rel_path for s in SOURCES]
        for bad in ("Tomato/leaf blight", "Tomato/verticulium wilt", "Tomato/leaf curl", "Dataset-Augmented"):
            self.assertFalse(any(bad in p for p in paths), bad)

    def test_labels_known(self):
        m = load_manifest()
        for s in SOURCES:
            if s.role != "ood":
                self.assertIn(s.label, m.classes, s.source_id)

    def test_every_class_has_a_pool_source(self):
        m = load_manifest()
        have = {s.label for s in SOURCES if s.role == "pool"}
        self.assertEqual(sorted(set(m.classes) - have), [])


class HashTests(unittest.TestCase):
    def test_flips_and_rotations_collide(self):
        img = leaf(1)
        canon = dihedral_dhashes(img)[0]
        for t in (Image.Transpose.FLIP_LEFT_RIGHT, Image.Transpose.FLIP_TOP_BOTTOM, Image.Transpose.ROTATE_90,
                  Image.Transpose.ROTATE_180, Image.Transpose.ROTATE_270):
            d = min(hamming(canon, v) for v in dihedral_dhashes(img.transpose(t)))
            self.assertLessEqual(d, DEFAULT_MAX_DISTANCE, t)

    def test_distinct_images_do_not_collide(self):
        a, b = dihedral_dhashes(leaf(1))[0], dihedral_dhashes(leaf(2))[0]
        self.assertGreater(hamming(a, b), DEFAULT_MAX_DISTANCE)

    def test_all_pairs_search_is_exact_at_the_boundary(self):
        rng = random.Random(0)
        D = DEFAULT_MAX_DISTANCE
        canon = [rng.getrandbits(256) for _ in range(120)]
        bits = lambda k: sum(1 << b for b in rng.sample(range(256), k))  # noqa: E731
        canon += [c ^ bits(D) for c in canon[:30]]         # exactly at threshold: must match
        canon += [c ^ bits(D + 1) for c in canon[30:60]]   # one past: must not
        variants = [[c] * 8 for c in canon]
        got = near_duplicate_pairs(canon, variants, D)
        brute = {(i, j) for i in range(len(canon)) for j in range(i + 1, len(canon))
                 if hamming(canon[i], canon[j]) <= D}
        self.assertEqual(got, brute)
        self.assertEqual(len(got), 30)

    def test_matches_through_any_orientation(self):
        canon = [1 << 200, 7]
        variants = [[1 << 200] * 8, [7, 7, 7, 1 << 200, 7, 7, 7, 7]]  # 2nd image rotated == 1st
        self.assertEqual(near_duplicate_pairs(canon, variants, 0), {(0, 1)})


def rec(path, label, base, hashes, role="pool", sha=None, derived=False):
    return Record(path=path, source_id="t", origin="t", kind="field", role=role, label=label,
                  sha256=sha or path, hashes=hashes, base_group=base, derived=derived)


class SplitTests(unittest.TestCase):
    def test_plantvillage_keys(self):
        p = Path("00f16858-f392___JR_Sept.L.S 8368_180deg.JPG")
        self.assertEqual(base_group_key("pv", "plantvillage_uuid", p), "pv:00f16858-f392")
        self.assertTrue(is_derived("plantvillage_uuid", p))
        self.assertFalse(is_derived("plantvillage_uuid", Path("00f16858-f392___JR_Sept.L.S 8368.JPG")))

    def _records(self, n=200):
        rng = random.Random(1)
        rs = []
        for i in range(n):
            h = rng.getrandbits(256)
            label = "Tomato___Healthy" if i % 2 else "Tomato___Early_Blight"
            rs.append(rec(f"a{i}.jpg", label, f"g{i}", [h] * 8))
            rs.append(rec(f"a{i}_flip.jpg", label, f"g{i}", [h] * 8, derived=True))      # same base group
            rs.append(rec(f"b{i}.jpg", label, f"x{i}", [h ^ 1] * 8))                      # near-duplicate
        return rs

    def test_groups_never_span_splits(self):
        rs = self._records()
        assign_groups(rs, DEFAULT_MAX_DISTANCE)
        assign_splits(rs, seed=42)
        by_group = {}
        for r in rs:
            by_group.setdefault(r.group, set()).add(r.split)
        self.assertTrue(all(len(s) == 1 for s in by_group.values()))
        self.assertEqual(len(by_group), 200)  # a{i}, flip, b{i} collapse into one group
        self.assertEqual({r.split for r in rs}, {"train", "val", "test"})

    def test_deterministic(self):
        a, b = self._records(), self._records()
        for rs in (a, b):
            assign_groups(rs, DEFAULT_MAX_DISTANCE)
            assign_splits(rs, seed=42)
        self.assertEqual([r.split for r in a], [r.split for r in b])

    def test_field_near_duplicate_of_pool_is_excluded(self):
        rs = self._records(30)
        rs.append(rec("field.jpg", "Tomato___Healthy", "f1", rs[3].hashes, role="field"))
        assign_groups(rs, DEFAULT_MAX_DISTANCE)
        assign_splits(rs, seed=42)
        self.assertEqual(rs[-1].split, "excluded")

    def test_cross_label_near_duplicates_never_straddle_splits(self):
        rs = self._records(30)
        twin = rec("twin.jpg", "Cashew___Gummosis", "t1", rs[0].hashes)             # pool, other label
        probe = rec("probe.jpg", "OOD___Avocado", "o1", rs[3].hashes, role="ood")    # eval, other label
        rs += [twin, probe]
        stats = assign_groups(rs, DEFAULT_MAX_DISTANCE)
        assign_splits(rs, seed=42)
        resolve_cross_label(rs, stats["cross_label_near_dups"])
        self.assertEqual((rs[0].split, twin.split), ("excluded", "excluded"))
        self.assertEqual(probe.split, "excluded")
        self.assertNotEqual(rs[3].split, "excluded")   # pool image kept; only the eval probe goes

    def test_exact_label_conflict_dropped(self):
        rs = [rec("a.jpg", "Tomato___Healthy", "a", [1] * 8, sha="same"),
              rec("b.jpg", "Tomato___Late_Blight", "b", [1] * 8, sha="same"),
              rec("c.jpg", "Tomato___Healthy", "c", [2] * 8)]
        kept, conflicts = drop_exact_conflicts(rs)
        self.assertEqual([r.path for r in kept], ["c.jpg"])
        self.assertEqual(conflicts[0]["labels"], ["Tomato___Healthy", "Tomato___Late_Blight"])


class AugmentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.src = self.tmp / "src.jpg"
        leaf(3).save(self.src)

    def test_refuses_non_train_rows_and_writes_nothing(self):
        rows = [{"path": str(self.src), "label": "Tomato___Healthy", "split": "train", "group": "g"},
                {"path": str(self.src), "label": "Tomato___Healthy", "split": "test", "group": "h"}]
        with self.assertRaises(SplitLeakError):
            augment_train_split(rows, self.tmp / "ds", AugConfig())
        self.assertFalse((self.tmp / "ds").exists())

    def test_writes_only_under_train_keeping_group(self):
        rows = [{"path": str(self.src), "label": "Tomato___Healthy", "split": "train", "group": "g1",
                 "derived": False}]
        out = augment_train_split(rows, self.tmp / "ds", AugConfig(copies_per_image=3))
        self.assertEqual(len(out["written"]), 3)
        train_root = (self.tmp / "ds" / "train").resolve()
        for w in out["written"]:
            self.assertIn(train_root, Path(w["path"]).parents)
            self.assertEqual(w["group"], "g1")
        self.assertEqual(out["background_skipped_no_mask"], 3)  # no mask -> never guess one
        self.assertFalse((self.tmp / "ds" / "val").exists())

    def test_skips_source_side_augmented_copies(self):
        rows = [{"path": str(self.src), "label": "Tomato___Healthy", "split": "train", "group": "g1",
                 "derived": True}]
        self.assertEqual(augment_train_split(rows, self.tmp / "ds", AugConfig())["written"], [])


class AbstentionTests(unittest.TestCase):
    def test_shared_cases(self):
        m = load_manifest()
        for c in CASES:
            d = abstention.decide(c["probs"], m, c["declaredCrop"])
            self.assertEqual((d.answer, d.reason), (c["answer"], c["reason"]), c["name"])


class MetricsTests(unittest.TestCase):
    def test_definitions(self):
        S, E, H = "Tomato___Septoria_Leaf_Spot", "Tomato___Early_Blight", "Tomato___Healthy"
        y_true = [S, S, S, S, E, E, H, H, "OOD___Avocado"]
        y_pred = [S, E, None, S, E, S, H, E, None]
        r = metrics.report(y_true, y_pred, [S, E, H], pairs=[metrics.SEPTORIA_VS_EARLY_BLIGHT])
        self.assertAlmostEqual(r["abstention_rate"], 2 / 9)
        self.assertAlmostEqual(r["confidently_wrong_rate"], 3 / 9)   # S->E, E->S, H->E
        self.assertAlmostEqual(r["per_class"][S]["recall"], 2 / 4)   # abstain is a miss
        self.assertAlmostEqual(r["healthy_forced_rate"], 1 / 2)
        pair = r["pairs"][f"{S} vs {E}"]
        self.assertEqual(pair[f"{S} -> {E}"], 1)
        self.assertEqual(pair[f"{E} -> {S}"], 1)
        self.assertEqual(r["confusion"][S][metrics.NOT_SURE], 1)

    def test_answer_on_ood_is_confidently_wrong(self):
        r = metrics.report(["OOD___Avocado"], ["Mango___Anthracnose"], ["Mango___Anthracnose"])
        self.assertEqual(r["confidently_wrong_rate"], 1.0)


class VerifyGateTests(unittest.TestCase):
    def _row(self, path, label, split, group, sha=None, h="0000000000000001"):
        return {"path": path, "source_id": "s", "label": label, "split": split, "group": group,
                "sha256": sha or path, "dhash8": ";".join([h] * 8), "derived": "0"}

    def test_detects_group_across_splits_and_maize(self):
        rows = [self._row("a.jpg", "Tomato___Healthy", "train", "g1", h="00000000000000ff"),
                self._row("b.jpg", "Tomato___Healthy", "test", "g1", h="ffff000000000000"),
                self._row("maize/c.jpg", "Tomato___Healthy", "train", "g2", h="0f0f0f0f0f0f0f0f")]
        res = run_checks(rows)
        self.assertFalse(res["G3 no maize/cassava"][0])
        self.assertFalse(res["G5 group in one split"][0])

    def test_detects_near_duplicate_across_splits(self):
        rows = [self._row("a.jpg", "Tomato___Healthy", "train", "g1", h="00000000000000ff"),
                self._row("b.jpg", "Tomato___Late_Blight", "test", "g2", h="00000000000000fe")]
        self.assertFalse(run_checks(rows)["G7 no near-duplicate across splits"][0])


if __name__ == "__main__":
    unittest.main()
