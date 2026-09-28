"""Mutation check: each guard, when broken, must make the test suite fail.

    python tests/mutation_check.py
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MUTATIONS = [
    ("pipeline/abstention.py", ">= manifest.healthy_guard", "> manifest.healthy_guard", "healthy guard"),
    ("pipeline/abstention.py", "top_p < manifest.min_confidence", "top_p < 0", "low-confidence abstention"),
    ("pipeline/augment.py", "    if bad:\n", "    if False:\n", "train-only augmentation guard"),
    ("pipeline/split.py", 'r.split = "excluded"', "r.split = r.role", "field contamination exclusion"),
    ("pipeline/split.py", "if records[a].label == records[b].label:", "if False:", "near-duplicate grouping"),
    ("pipeline/split.py", 'if a.role == "pool" and b.role == "pool":', "if False:", "cross-label pool exclusion"),
    ("pipeline/imagehash.py", "d <= max_distance", "d < max_distance", "near-duplicate threshold boundary"),
    ("pipeline/imagehash.py", ".min(axis=1)", "[:, 0, :]", "orientation-invariant matching"),
    ("pipeline/manifest.py", "        if m:\n", "        if False:\n", "dosage lint"),
    ("pipeline/manifest.py", 'if f"{crop}___Healthy" not in classes:', "if False:", "Healthy-per-crop rule"),
]


def suite_passes() -> bool:
    r = subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", "tests"], cwd=ROOT,
                       capture_output=True, text=True)
    return r.returncode == 0


def main() -> int:
    assert suite_passes(), "suite must pass before mutating"
    survived = []
    for rel, old, new, name in MUTATIONS:
        path = ROOT / rel
        original = path.read_text(encoding="utf-8")
        assert old in original, f"mutation anchor not found: {name}"
        path.write_text(original.replace(old, new, 1), encoding="utf-8")
        try:
            caught = not suite_passes()
        finally:
            path.write_text(original, encoding="utf-8")
        print(f"{'caught  ' if caught else 'SURVIVED'} {name}")
        if not caught:
            survived.append(name)
    return 1 if survived else 0


if __name__ == "__main__":
    sys.exit(main())
