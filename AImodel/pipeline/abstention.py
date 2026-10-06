"""Abstention policy: when the product must answer "not sure" (sipati uhakika).

Mirrored exactly by packages/ai/abstention.ts; both are checked against the
shared cases in packages/ai/abstention-cases.json.

Rules, first match wins:
  1. declared crop is in scope but untrained (Avocado)       -> crop_not_supported
  2. declared crop is not a trained crop                      -> unknown_crop
  3. probability mass of the top crop < minCropMass           -> unknown_crop
  4. declared crop given and model's top crop differs         -> crop_mismatch
  5. top-1 confidence < minConfidence                         -> low_confidence
  6. top-1 is a disease but that crop's Healthy >= healthyGuard -> healthy_ambiguous
     (never force a disease label onto a leaf that may be healthy)
  otherwise answer top-1.

Mango Cercospora and avocado photos WITHOUT a declared crop have no dedicated
rule: the model has no class for them, so only rules 3/5/6 can catch them.
The OOD probe sets measure how often they do. That limit is stated, not hidden.
"""
from __future__ import annotations

from dataclasses import dataclass

from .manifest import Manifest, crop_of, disease_of


@dataclass(frozen=True)
class Decision:
    answer: str | None       # class label, or None when abstaining
    reason: str              # "answered" or the abstention reason
    confidence: float        # top-1 probability
    crop: str | None         # model's top crop


def decide(probs: dict[str, float], manifest: Manifest, declared_crop: str | None = None) -> Decision:
    if not probs:
        return Decision(None, "no_prediction", 0.0, None)
    top_label = max(probs, key=probs.get)
    top_p = probs[top_label]

    crop_mass: dict[str, float] = {}
    for label, p in probs.items():
        crop_mass[crop_of(label)] = crop_mass.get(crop_of(label), 0.0) + p
    top_crop = max(crop_mass, key=crop_mass.get)

    if declared_crop is not None:
        if declared_crop in manifest.not_trained_crops:
            return Decision(None, "crop_not_supported", top_p, top_crop)
        if declared_crop not in manifest.trained_crops:
            return Decision(None, "unknown_crop", top_p, top_crop)
    if crop_mass[top_crop] < manifest.min_crop_mass:
        return Decision(None, "unknown_crop", top_p, top_crop)
    if declared_crop is not None and declared_crop != top_crop:
        return Decision(None, "crop_mismatch", top_p, top_crop)
    if top_p < manifest.min_confidence:
        return Decision(None, "low_confidence", top_p, top_crop)
    if disease_of(top_label) != "Healthy":
        if probs.get(manifest.healthy_label(crop_of(top_label)), 0.0) >= manifest.healthy_guard:
            return Decision(None, "healthy_ambiguous", top_p, top_crop)
    return Decision(top_label, "answered", top_p, top_crop)
