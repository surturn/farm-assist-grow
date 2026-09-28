# Handoff — Phase 1 data pipeline (2026-09-28)

**Worktree:** `.claude/worktrees/phase1-data-pipeline`, branch `worktree-phase1-data-pipeline`. **Uncommitted.**
**Design:** `2026-09-28-phase1-v1-class-scope-and-data-pipeline.md` (read first).
**Data:** datasets live in the main checkout; run with `FARM_DATA_ROOT=C:/Users/semutryr/Desktop/Projects/farm-assist-grow/AImodel`.

## Done
- `packages/ai/class-manifest.json`: frozen 33 classes, Healthy for every crop, maize/cassava excluded, avocado and mango cercospora marked `notTrained`.
- `packages/ai/crop-knowledge.json`: 33 entries, `reviewed:false`, no dosages, no severity.
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

## Gate state (last complete run)
- G1–G7 pass: 27,293 groups, 0 cross-split, 0 maize/cassava.
- G8 fails: 14 classes have no data.
- G9 fails: no field test sets.
- Result: `TRAIN_READY=False`, which is expected until the downloads below are in place.

## Interrupted
- The final rebuild + verify was killed by the OS for low memory. It was not a code failure.
- `splits/v1/summary.json` and `splits/v1/verify.json` predate the `resolve_cross_label` rule. Only 1 pair is affected (a false positive, and it did not cross splits).
- Planned but unapplied: lower `near_duplicate_pairs(chunk=16)` to `8` in `pipeline/imagehash.py`, which roughly halves peak memory. The rebuild takes about 20 minutes.

## Next
1. Apply the chunk=8 change, then rebuild and verify when memory allows.
2. Download the datasets into `AImodel/external/` (table in design §7).
3. Re-run `build_split.py` then `verify_split.py`. Train only when `TRAIN_READY=True`.
4. Commit only after the user approves. No AI attribution in commits.

## Open
- `apps/frontend/src/lib/disease_fallback.ts` still lists maize diseases. Fix in a separate PR.
- The dashboard WhatsApp bridges spec is on branch `docs/dashboard-whatsapp-bridges-spec` (commit `5b94c00`) and is paused.
