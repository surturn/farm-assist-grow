# Phase 1 Amendment — v1 Class Scope and Leak-Free Data Pipeline

**Date:** 2026-09-28
**Status:** Implemented (data pipeline only). Training blocked until `verify_split.py` reports `TRAIN_READY`.
**Amends:** [Local-First Crop Diagnosis — Phase 1](./2026-08-06-local-first-crop-diagnosis-design.md)

Training the model now takes priority over the dashboard WhatsApp bridges. This amendment
changes *what* the classifier learns and *how its data is prepared*. The inference service,
resolver and OpenAI fallback in the Phase 1 spec are unchanged.

## 1. Frozen v1 class list

Source of truth: `packages/ai/class-manifest.json` (`v1-2026-09-28`, `frozen: true`). Every
pipeline step and the backend read classes from it; nothing else may hard-code a class list.

| Crop | Classes | Count |
|---|---|---|
| Coffee | Cercospora Leaf Spot, Leaf Miner, Phoma, Rust, Healthy | 5 |
| Tomato | Bacterial Spot, Early Blight, Late Blight, Leaf Mold, Mosaic Virus, Septoria Leaf Spot, Target Spot, Yellow Leaf Curl Virus, Healthy | 9 |
| Pepper | Anthracnose, Bacterial Spot, Mosaic Virus, Healthy | 4 |
| Bean (French beans) | Angular Leaf Spot, Anthracnose, Rust, Healthy | 4 |
| Potato | Early Blight, Late Blight, Healthy | 3 |
| Mango | Anthracnose, Powdery Mildew, Healthy | 3 |
| Cashew | Anthracnose, Gummosis, Leaf Miner, Red Rust, Healthy | 5 |
| **Total** | | **33** |

Rules, enforced by `validate_manifest` (Python) and `checkManifestAndKnowledge` (TypeScript):

- Every trained crop has a `Healthy` class. Without it a healthy leaf is forced into a disease.
- Tomato keeps Septoria, Target Spot and Mosaic: removing a class does not remove the disease
  from farms, it makes the model mislabel it.
- Cashew is kept (data already present, no cost).
- **Maize and cassava are removed entirely** (`excludedCrops`, `excludedTokens`).

### In scope but not trained

Avocado (all diseases) and Mango Cercospora have no usable public data. They are listed under
`notTrained` and are always answered "not sure". Training them needs purpose-collected Kenyan
field photos.

## 2. Abstention ("not sure" / *sipati uhakika*)

`AImodel/pipeline/abstention.py`, mirrored exactly by `packages/ai/abstention.ts`. Both run the
shared cases in `packages/ai/abstention-cases.json`. First matching rule wins:

1. Declared crop is untrained (Avocado) → `crop_not_supported`
2. Declared crop is not a trained crop (e.g. Maize) → `unknown_crop`
3. Top crop's summed probability < `minCropMass` → `unknown_crop`
4. Declared crop ≠ model's top crop → `crop_mismatch`
5. Top-1 < `minConfidence` → `low_confidence`
6. Top-1 is a disease and that crop's Healthy ≥ `healthyGuard` → `healthy_ambiguous`

Thresholds (`0.85 / 0.90 / 0.15`) are **uncalibrated placeholders**, deliberately conservative.
`evaluate.py` sets them from the field-photo confidence curve; they must not be loosened before
that.

**Known limit.** Avocado or mango-cercospora photos *without* a declared crop have no dedicated
rule. The model has no class for them, so only rules 3, 5 and 6 can catch them. The OOD probe
sets (§5) measure how often that works.

## 3. Maize and cassava removal

- `PlantDoc1` (maize only) dropped completely.
- Maize and cassava rows are absent from the source registry (`pipeline/sources.py`): there is no
  skip flag to forget, since unregistered folders are never read.
- `merge_datasets.py`, `data.yaml` and `generate_yaml.py`, which carried the 30-class list, are
  deleted.
- `crop-knowledge.json` holds exactly the 33 classes.
- Boot check: `apps/backend/src/server.ts` calls `assertKnowledgeMatchesManifest()` before
  listening. A missing entry, a leftover class, a stored `severity`, or anything that looks like a
  dosage fails startup.
- `verify_split.py` G3 fails if any row's path, source or label contains a maize, corn or cassava
  token.

## 4. Split first, augment train only

### Grouping

No source on disk publishes farm, session or plant IDs, so the finest provable unit is used,
then widened:

1. **PlantVillage:** group = UUID before `___`. The source's own flips, rotations and colour
   variants (`_180deg`, `_flipTB`, `_newPixel25`, …) share it.
2. **Other sources:** group = file.
3. **Near-duplicate union:** any two same-label images whose 256-bit dHash is within Hamming
   distance 24 in *any* of the 8 flip/90° orientations join one group. This catches re-shot
   leaves, burst frames and copies. The all-pairs search is exact and vectorised. Crops and
   zooms are not caught.

   **Calibrated on the real data** (`tests/calibrate_hash.py`). Positives are PlantVillage
   siblings (same photo, flipped); negatives are different-UUID and different-file pairs.

   | Hash | Same photo, max distance | Different leaves, min distance |
   |---|---|---|
   | 64-bit | 5 | 7 |
   | 256-bit | 21 | 51 |

   The first run used 64-bit at distance 4. It flagged 24,276 cross-label "duplicates" and
   chained same-label groups up to 991 images. On inspection these were different leaves
   photographed in the same way: one leaf centred on a white sheet. A 2-bit margin cannot
   survive roughly 900 million pairs.

When field collection records farm or session IDs, a grouping mode using them replaces rule 2.

### Split

Per class, groups are ordered by `sha256(seed:group)` and cut 80/10/10 by group count, which is
deterministic. Only `pool` sources are split. `field` and `ood` sources are never trained on.
A field image that near-duplicates any training image is marked `excluded`.

Other exclusions:
- Identical bytes under two labels: dropped.
- Unreadable images: skipped and listed.
- Unprovable mappings (not registered):
  - CCMT tomato "leaf blight": early or late blight is unknown, and the old merge guessed late.
  - "verticulium wilt": its files are named `leaf blight…`.
  - "leaf curl": not provably TYLCV.
- CCMT uses `Raw Data`, not the pre-augmented copy.

### Augmentation

`materialize.py` hard-links the verified split into `KenyaCropDisease_v2/{train,val,test}`. Only
then does `pipeline/augment.py` write field-condition copies (sun and white balance, cast
shadows, hand-shake blur, defocus, JPEG) into **train only**.

`augment_train_split` raises `SplitLeakError` before writing anything if given a non-train row,
or if an output would land outside `train/`. Augmented files inherit their source's group.

Background replacement runs only with a real PlantVillage *segmented* mask (`--masks`); without
one it is skipped and counted, never approximated. Val and test receive one image per original
photo; source-side augmented copies are train-only.

## 5. Field evaluation plan

PlantVillage lab accuracy is **not** product accuracy and is never reported as such.

| Crop | Field test set | Role |
|---|---|---|
| Coffee | BRACOL (Brazil, smartphone, not augmented); RoCoLe for rust vs healthy | `field` |
| Tomato, Pepper, Potato | Original PlantDoc `test/` (web-sourced field photos) | `field` |
| Bean, Mango, Cashew | Held-out test split only (sources are already field photos); no independent set yet | `test` |
| Avocado, Mango Cercospora | OOD probe sets (to collect) | `ood` |

**Metrics** (`pipeline/metrics.py`; definitions fixed before any number exists):
- Per-class recall and precision. An abstention counts as a miss, never a hit.
- Macro F1.
- Confusion matrix with a `NOT_SURE` column.
- Abstention rate and coverage.
- **Confidently-wrong rate:** answered and wrong, over all images.
- Healthy-forced rate: healthy leaves answered as a disease.
- The Septoria vs Early Blight pair, both directions, as counts and rates.
- Any answer on an OOD image is confidently wrong.

## 6. Gates

`verify_split.py` must print `TRAIN_READY=True` before any training:

| Gate | Check |
|---|---|
| G1 | Manifest valid, frozen, Healthy per crop, no excluded crop |
| G2 | Knowledge table == classes; no severity; no dosage |
| G3 | No maize/corn/cassava token in any row |
| G4 | Every label is a manifest class or OOD probe |
| G5 | Every group in exactly one split |
| G6 | No identical file in two splits |
| G7 | No near-duplicate across splits |
| G8 | Every class ≥ 50 train groups, ≥ 1 val and ≥ 1 test group |
| G9 | Field sets for coffee, tomato, pepper, potato (`EVAL_READY`) |

## 7. Data still to download

Unpack under `AImodel/external/` using the folder names in `pipeline/sources.py`, then re-run
`build_split.py`. Confirm each licence at download.

| Dataset | Unpack to | Classes |
|---|---|---|
| JMuBEN + JMuBEN2 (CC BY 4.0) | `external/JMuBEN/{Cerscospora,Rust,Phoma,Miner,Healthy}` | Coffee ×5 |
| iBean (MIT) | `external/iBean/{angular_leaf_spot,bean_rust,healthy}` | Bean |
| Tanzania common bean (Zenodo) | `external/TanzaniaBean/{anthracnose,rust,healthy}` | Bean |
| Chili leaf (Mendeley; mosaic source to confirm) | `external/Chili/{anthracnose,mosaic,healthy}` | Pepper |
| MangoLeafBD | `external/MangoLeafBD/{Anthracnose,Powdery Mildew,Healthy}` | Mango |
| BRACOL | `external/BRACOL/{rust,cercospora,miner,phoma,healthy}` | Coffee field test |
| RoCoLe | `external/RoCoLe/{rust,healthy}` | Coffee field test |
| PlantDoc (CC BY 4.0) | `external/PlantDoc/test/<class folders>` | Tomato/pepper/potato field test |
| PlantVillage segmented | passed via `materialize.py --masks` | Background replacement |

## 8. Out of scope here

- Training, the inference service and threshold calibration. Those wait for `TRAIN_READY`.
- Frontend: `apps/frontend/src/lib/disease_fallback.ts` still lists maize diseases in the manual
  fallback picker. That is a product-facing change for a separate PR.
