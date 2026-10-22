"""Class manifest: the frozen v1 class list, shared with packages/ai.

Every other pipeline step reads classes from here. Nothing else in AImodel/ may
hard-code a class list.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = REPO_ROOT / "packages" / "ai" / "class-manifest.json"
KNOWLEDGE_PATH = REPO_ROOT / "packages" / "ai" / "crop-knowledge.json"

LABEL_RE = re.compile(r"^[A-Z][A-Za-z]+___[A-Z][A-Za-z_]+$")
KNOWLEDGE_FIELDS = ("diseaseName", "cropType", "symptoms", "possibleCauses", "treatment", "prevention", "reviewed",
                    "source", "chemicals", "sw")

# Dosage / mixing-rate patterns. Knowledge text may name active ingredients but
# must defer quantities to extension services.
DOSAGE_RE = re.compile(
    r"\d+(\.\d+)?\s*(ml|mls|millilit|l\b|lit|g\b|gm|gram|kg|cc|%|oz|tbsp|tsp|ppm)"
    r"|per\s+(litre|liter|acre|hectare|ha\b|knapsack|20\s*l)"
    r"|\bkg/ha\b|\bl/ha\b",
    re.IGNORECASE,
)


class ManifestError(ValueError):
    pass


def crop_of(label: str) -> str:
    return label.split("___", 1)[0]


def disease_of(label: str) -> str:
    return label.split("___", 1)[1]


@dataclass(frozen=True)
class Manifest:
    version: str
    classes: tuple[str, ...]
    trained_crops: tuple[str, ...]
    excluded_crops: tuple[str, ...]
    excluded_tokens: tuple[str, ...]
    not_trained_crops: tuple[str, ...]
    not_trained_labels: tuple[str, ...]
    min_confidence: float
    min_crop_mass: float
    healthy_guard: float
    calibrated: bool

    def healthy_label(self, crop: str) -> str:
        return f"{crop}___Healthy"

    def is_healthy(self, label: str) -> bool:
        return disease_of(label) == "Healthy"

    def mentions_excluded(self, text: str) -> bool:
        low = text.lower()
        return any(tok in low for tok in self.excluded_tokens)


def validate_manifest(raw: dict) -> Manifest:
    errors: list[str] = []
    classes = raw.get("classes", [])
    trained = raw.get("trainedCrops", [])
    excluded = raw.get("excludedCrops", [])
    tokens = [t.lower() for t in raw.get("excludedTokens", [])]
    nt = raw.get("notTrained", {})
    ab = raw.get("abstention", {})

    if not raw.get("frozen"):
        errors.append("manifest must be frozen for v1")
    if len(set(classes)) != len(classes):
        errors.append("duplicate class labels")
    for c in classes:
        if not LABEL_RE.match(c):
            errors.append(f"bad label format: {c}")
        if any(t in c.lower() for t in tokens):
            errors.append(f"excluded crop in class list: {c}")
        if crop_of(c) not in trained:
            errors.append(f"class {c} has crop not in trainedCrops")
    for crop in trained:
        if crop in excluded:
            errors.append(f"crop {crop} is both trained and excluded")
        if f"{crop}___Healthy" not in classes:
            errors.append(f"crop {crop} has no Healthy class")
        if not any(crop_of(c) == crop and disease_of(c) != "Healthy" for c in classes):
            errors.append(f"crop {crop} has no disease class")
    for label in nt.get("labels", []):
        if label in classes:
            errors.append(f"notTrained label {label} is also a trained class")
    for crop in nt.get("crops", []):
        if crop in trained:
            errors.append(f"notTrained crop {crop} is also a trained crop")
    for key in ("minConfidence", "minCropMass", "healthyGuard"):
        v = ab.get(key)
        if not isinstance(v, (int, float)) or not 0 < v < 1:
            errors.append(f"abstention.{key} must be in (0,1)")
    if errors:
        raise ManifestError("; ".join(errors))

    return Manifest(
        version=raw["version"],
        classes=tuple(classes),
        trained_crops=tuple(trained),
        excluded_crops=tuple(excluded),
        excluded_tokens=tuple(tokens),
        not_trained_crops=tuple(nt.get("crops", [])),
        not_trained_labels=tuple(nt.get("labels", [])),
        min_confidence=float(ab["minConfidence"]),
        min_crop_mass=float(ab["minCropMass"]),
        healthy_guard=float(ab["healthyGuard"]),
        calibrated=bool(ab.get("calibrated", False)),
    )


def load_manifest(path: Path = MANIFEST_PATH) -> Manifest:
    return validate_manifest(json.loads(path.read_text(encoding="utf-8")))


def check_knowledge(manifest: Manifest, knowledge: dict) -> list[str]:
    """Knowledge table must cover exactly the trained classes, with no dosages."""
    errors: list[str] = []
    keys = set(knowledge)
    want = set(manifest.classes)
    for missing in sorted(want - keys):
        errors.append(f"knowledge missing class {missing}")
    for extra in sorted(keys - want):
        errors.append(f"knowledge has entry for non-class {extra}")
    for label in sorted(keys & want):
        entry = knowledge[label]
        for field in KNOWLEDGE_FIELDS:
            if field not in entry:
                errors.append(f"{label}: missing field {field}")
        if entry.get("cropType") != crop_of(label):
            errors.append(f"{label}: cropType {entry.get('cropType')!r} != {crop_of(label)!r}")
        if "severity" in entry:
            errors.append(f"{label}: severity must not be stored (model does not assess it)")
        text = json.dumps({k: entry.get(k) for k in ("symptoms", "possibleCauses", "treatment", "prevention", "sw", "chemicals", "short")})
        m = DOSAGE_RE.search(text)
        if m:
            errors.append(f"{label}: looks like a dosage ({m.group(0)!r}); defer quantities to extension services")
    return errors


def check_model_classes(manifest: Manifest, model_names: list[str]) -> list[str]:
    """For the inference service /health and evaluate.py: model output == manifest."""
    errors = []
    if sorted(model_names) != sorted(manifest.classes):
        missing = sorted(set(manifest.classes) - set(model_names))
        extra = sorted(set(model_names) - set(manifest.classes))
        errors.append(f"model classes differ from manifest: missing={missing} extra={extra}")
    return errors
