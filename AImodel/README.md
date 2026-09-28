# AImodel — crop disease data pipeline

Design: `docs/superpowers/specs/2026-09-28-phase1-v1-class-scope-and-data-pipeline.md`.
Classes: `packages/ai/class-manifest.json` (the only class list).

```bash
# datasets live outside git; FARM_DATA_ROOT defaults to this folder
python build_split.py        # scan + hash + group + split  -> splits/v1/
python verify_split.py       # hard gate: must print TRAIN_READY=True
python materialize.py        # hard-link split, augment train only
python -m unittest discover -s tests      # pipeline tests
python tests/mutation_check.py            # proves the tests catch broken guards
```

Do not train until `verify_split.py` passes. Do not report PlantVillage lab accuracy
as product accuracy.
