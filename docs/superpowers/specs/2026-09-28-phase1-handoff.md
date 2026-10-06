# Handoff — Phase 1 data pipeline (2026-09-28)

**Worktree:** `.claude/worktrees/phase1-data-pipeline`, branch `worktree-phase1-data-pipeline`. Committed (`a4aeb80` onward), not merged.
**Design:** `2026-09-28-phase1-v1-class-scope-and-data-pipeline.md` (read first).
**Data:** datasets live in the main checkout; run with `FARM_DATA_ROOT=C:/Users/semutryr/Desktop/Projects/farm-assist-grow/AImodel`.

## Done
- `packages/ai/class-manifest.json` (`v1.1`): frozen 30 classes, Healthy for every crop, maize/cassava excluded. Avocado and **mango** are `notTrained`; mango was deferred because MangoLeafBD is CC BY-NC.
- `packages/ai/crop-knowledge.json`: 30 entries, `reviewed:false`, no dosages, no severity.
- Boot check `assertKnowledgeMatchesManifest()` called in `apps/backend/src/server.ts`.
- Abstention policy in Python (`AImodel/pipeline/abstention.py`) and TypeScript (`packages/ai/abstention.ts`), both tested against the same cases in `abstention-cases.json`.
- `AImodel/pipeline/`: source registry, 256-bit dHash grouping (calibrated), grouped split, train-only augmentation, metrics.
- CLIs: `build_split.py`, `verify_split.py`, `materialize.py`.
- Deleted `merge_datasets.py`, `data.yaml`, `generate_yaml.py`.
- Tests:
  - Python: 32 pass (`python -m unittest discover -s tests`).
  - Mutation check: 10 of 10 broken guards caught (`tests/mutation_check.py`).
  - TypeScript: 14 pass (`npm run test:ai`).
  - Backend `tsc --noEmit` is clean.

## Gate state (current, committed `splits/v1/*.json`)
- G1–G7 pass: 27,292 groups, 24,223 same-label near-duplicate pairs, 0 cross-split, 0 maize/cassava.
- The 1 cross-label pair (a false positive) is excluded.
- G8 fails: 14 classes have no data.
- G9 fails: no field test sets.
- Result: `TRAIN_READY=False`, which is expected until the downloads below are in place.
- The near-duplicate search runs on CUDA when available: ±1 vectors, where dot product gives Hamming distance, exact in fp16. The CPU popcount is the fallback, and a test asserts both give identical pairs.
- `build_split.py` and `verify_split.py` now take minutes each, down from about 20 on CPU.

## Downloads (`fetch_datasets.py`, then `organize_datasets.py`)
- Done and organised: iBean (Hugging Face mirror) and PlantDoc `test/`.
- Partial, resumable:
  - JMuBEN: Cercospora and Rust verified; Phoma is `.part`.
  - Tanzania bean: `anthra.zip` is partial.
- Not started: JMuBEN2, BRACOL, RoCoLe, Chili.
- Both jobs stopped. The Mendeley job lost the network (DNS failures); the bean job was killed for low memory.
- BRACOL, RoCoLe and Chili need organiser functions once their archive layouts are known. Their labels are in CSV/JSON files, not folders.
- Pepper mosaic has no confirmed source yet.
- **Field sets too small:** PlantDoc `test/` gives only 6–11 images per class, with none for Target Spot or Potato Healthy. G9 checks presence, not size.
  - Fix: fetch PlantDoc `train/` too (about 2,300 images). It is never trained on, so it can be used for field eval.
  - Then add a minimum count per class to G9.

## Gate state after mango deferral (v1.1, committed evidence)
- G1–G7 pass: 43,913 rows, 28,689 groups.
- G8 fails: 8 classes (coffee ×5, pepper anthracnose and mosaic, bean anthracnose).
- G9 fails: coffee field set only.

## Next
1. Download the datasets into `AImodel/external/` (table in design §7).
3. Re-run `build_split.py` then `verify_split.py`. Train only when `TRAIN_READY=True`.
4. Commit only after the user approves. No AI attribution in commits.

## Open
- `apps/frontend/src/lib/disease_fallback.ts` still lists maize diseases. Fix in a separate PR.
- The dashboard WhatsApp bridges spec is on branch `docs/dashboard-whatsapp-bridges-spec` (commit `5b94c00`) and is paused.
