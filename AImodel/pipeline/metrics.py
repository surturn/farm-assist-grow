"""Evaluation metrics for field-photo test sets.

Definitions (fixed now, so the numbers cannot be redefined after seeing them):
  N                    all scored images
  abstention_rate      abstained / N
  coverage             answered / N
  accuracy_answered    correct / answered
  confidently_wrong    answered AND wrong, over N. The harmful outcome: a
                       wrong label delivered without "not sure".
  healthy_forced       Healthy images answered with a disease, over Healthy N
  per-class recall     correct answers for class c / images of class c
                       (abstaining counts as NOT recalled - it is not a hit)
  macro F1             mean F1 over classes present in y_true; abstentions
                       count as misses for recall and never as predictions
  confusion matrix     rows = truth, cols = manifest classes + "NOT_SURE"
OOD images (truth outside the manifest) count toward N and abstention_rate;
any answer on them is confidently wrong.
"""
from __future__ import annotations

NOT_SURE = "NOT_SURE"


def confusion(y_true: list[str], y_pred: list[str | None], classes: list[str]) -> dict[str, dict[str, int]]:
    cols = list(classes) + [NOT_SURE]
    rows = sorted(set(y_true) | set(classes))
    m = {t: {c: 0 for c in cols} for t in rows}
    for t, p in zip(y_true, y_pred):
        m[t][p if p is not None else NOT_SURE] += 1
    return m


def report(y_true: list[str], y_pred: list[str | None], classes: list[str],
           pairs: list[tuple[str, str]] = ()) -> dict:
    assert len(y_true) == len(y_pred)
    n = len(y_true)
    class_set = set(classes)
    answered = [(t, p) for t, p in zip(y_true, y_pred) if p is not None]
    wrong = [(t, p) for t, p in answered if t != p]

    per_class = {}
    f1s = []
    for c in sorted(set(t for t in y_true if t in class_set)):
        support = sum(1 for t in y_true if t == c)
        tp = sum(1 for t, p in answered if t == c and p == c)
        predicted = sum(1 for _, p in answered if p == c)
        recall = tp / support if support else 0.0
        precision = tp / predicted if predicted else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        abstained = sum(1 for t, p in zip(y_true, y_pred) if t == c and p is None)
        per_class[c] = {"support": support, "recall": recall, "precision": precision, "f1": f1,
                        "abstained": abstained}
        f1s.append(f1)

    healthy = [(t, p) for t, p in zip(y_true, y_pred) if t.endswith("___Healthy")]
    healthy_forced = sum(1 for t, p in healthy if p is not None and not p.endswith("___Healthy"))

    cm = confusion(y_true, y_pred, classes)
    pair_report = {}
    for a, b in pairs:
        na = sum(1 for t in y_true if t == a)
        nb = sum(1 for t in y_true if t == b)
        pair_report[f"{a} vs {b}"] = {
            f"{a} -> {b}": cm.get(a, {}).get(b, 0), f"{a} support": na,
            f"{b} -> {a}": cm.get(b, {}).get(a, 0), f"{b} support": nb,
            f"{a} -> {b} rate": cm.get(a, {}).get(b, 0) / na if na else None,
            f"{b} -> {a} rate": cm.get(b, {}).get(a, 0) / nb if nb else None,
        }

    return {
        "n": n,
        "abstention_rate": (n - len(answered)) / n if n else 0.0,
        "coverage": len(answered) / n if n else 0.0,
        "accuracy_answered": (len(answered) - len(wrong)) / len(answered) if answered else None,
        "confidently_wrong_rate": len(wrong) / n if n else 0.0,
        "healthy_forced_rate": healthy_forced / len(healthy) if healthy else None,
        "macro_f1": sum(f1s) / len(f1s) if f1s else 0.0,
        "per_class": per_class,
        "pairs": pair_report,
        "confusion": cm,
    }


SEPTORIA_VS_EARLY_BLIGHT = ("Tomato___Septoria_Leaf_Spot", "Tomato___Early_Blight")
