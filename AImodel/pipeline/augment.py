"""Field-condition augmentation, applied to the TRAIN split only, after splitting.

Simulates smallholder smartphone photos: harsh or dim sunlight, cast shadows,
hand-held blur, JPEG recompression, and (only when a mask exists) busy
backgrounds. Every augmented file inherits its source row's group, so it can
never cross into another split.

Background replacement requires a real leaf mask (PlantVillage "segmented"
release). Without one it is skipped and counted - never approximated with a
guessed mask, which would paste background over leaf tissue.
"""
from __future__ import annotations

import io
import random
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


class SplitLeakError(RuntimeError):
    pass


@dataclass(frozen=True)
class AugConfig:
    copies_per_image: int = 1
    p_sun: float = 0.8
    p_shadow: float = 0.5
    p_motion_blur: float = 0.35
    p_defocus: float = 0.25
    p_jpeg: float = 0.6
    p_background: float = 0.5


def sunlight(img: Image.Image, rng: random.Random) -> Image.Image:
    img = ImageEnhance.Brightness(img).enhance(rng.uniform(0.55, 1.5))
    img = ImageEnhance.Contrast(img).enhance(rng.uniform(0.7, 1.35))
    img = ImageEnhance.Color(img).enhance(rng.uniform(0.75, 1.25))
    # warm/cool white balance shift
    arr = np.asarray(img, dtype=np.float32)
    shift = np.array([rng.uniform(0.9, 1.1), 1.0, rng.uniform(0.9, 1.1)], dtype=np.float32)
    return Image.fromarray(np.clip(arr * shift, 0, 255).astype(np.uint8))


def cast_shadow(img: Image.Image, rng: random.Random) -> Image.Image:
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    pts = [(rng.uniform(-0.2, 1.2) * w, rng.uniform(-0.2, 1.2) * h) for _ in range(rng.randint(3, 6))]
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=max(w, h) * rng.uniform(0.01, 0.05)))
    dark = ImageEnhance.Brightness(img).enhance(rng.uniform(0.35, 0.7))
    return Image.composite(dark, img, mask)


def motion_blur(img: Image.Image, rng: random.Random) -> Image.Image:
    size = rng.choice([3, 5])
    k = [0.0] * (size * size)
    if rng.random() < 0.5:
        for i in range(size):
            k[(size // 2) * size + i] = 1.0 / size   # horizontal shake
    else:
        for i in range(size):
            k[i * size + size // 2] = 1.0 / size     # vertical shake
    return img.filter(ImageFilter.Kernel((size, size), k, scale=1))


def defocus(img: Image.Image, rng: random.Random) -> Image.Image:
    return img.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.6, 1.8)))


def jpeg(img: Image.Image, rng: random.Random) -> Image.Image:
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=rng.randint(35, 80))
    buf.seek(0)
    return Image.open(buf).convert("RGB")


def replace_background(img: Image.Image, mask: Image.Image, background: Image.Image) -> Image.Image:
    bg = background.convert("RGB").resize(img.size)
    return Image.composite(img, bg, mask.convert("L").resize(img.size))


def augment_image(img: Image.Image, cfg: AugConfig, rng: random.Random,
                  mask: Image.Image | None = None, background: Image.Image | None = None) -> tuple[Image.Image, list[str]]:
    img = img.convert("RGB")
    ops: list[str] = []
    if mask is not None and background is not None and rng.random() < cfg.p_background:
        img = replace_background(img, mask, background); ops.append("background")
    if rng.random() < cfg.p_sun:
        img = sunlight(img, rng); ops.append("sun")
    if rng.random() < cfg.p_shadow:
        img = cast_shadow(img, rng); ops.append("shadow")
    if rng.random() < cfg.p_motion_blur:
        img = motion_blur(img, rng); ops.append("motion_blur")
    elif rng.random() < cfg.p_defocus:
        img = defocus(img, rng); ops.append("defocus")
    if rng.random() < cfg.p_jpeg:
        img = jpeg(img, rng); ops.append("jpeg")
    return img, ops


def augment_train_split(rows: list[dict], dataset_dir: Path, cfg: AugConfig, seed: int = 42,
                        mask_for=None, backgrounds: list[Path] | None = None) -> dict:
    """Write augmented copies into dataset_dir/train/<label>/ for train rows only.

    rows: split-manifest rows (dicts with path, label, split, group, derived).
    mask_for: optional callable(path) -> Path | None giving a leaf mask.
    Raises SplitLeakError before writing anything if a non-train row is passed
    or an output path would land outside dataset_dir/train.
    """
    train_root = (dataset_dir / "train").resolve()
    bad = [r["path"] for r in rows if r["split"] != "train"]
    if bad:
        raise SplitLeakError(f"{len(bad)} non-train rows passed to augmentation, e.g. {bad[0]}")

    rng = random.Random(seed)
    bg_pool = list(backgrounds or [])
    written: list[dict] = []
    skipped_background = 0
    for r in rows:
        if r.get("derived") in (True, "1", "True"):
            continue  # already an augmented copy; do not compound
        src = Path(r["path"])
        for c in range(cfg.copies_per_image):
            out = (train_root / r["label"] / f"aug{c}_{src.stem}.jpg").resolve()
            if train_root not in out.parents:
                raise SplitLeakError(f"augmentation output escapes train/: {out}")
            mask_path = mask_for(src) if mask_for else None
            mask = Image.open(mask_path) if mask_path else None
            background = Image.open(rng.choice(bg_pool)) if (mask is not None and bg_pool) else None
            if mask is None:
                skipped_background += 1
            with Image.open(src) as im:
                aug, ops = augment_image(im, cfg, rng, mask, background)
            out.parent.mkdir(parents=True, exist_ok=True)
            aug.save(out, "JPEG", quality=90)
            written.append({"path": str(out), "source_path": r["path"], "label": r["label"],
                            "group": r["group"], "split": "train", "ops": "+".join(ops)})
    return {"written": written, "background_skipped_no_mask": skipped_background}
