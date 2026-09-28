"""Near-duplicate detection without extra dependencies (PIL + numpy only).

A 256-bit difference hash (16x16 dHash) is computed for all 8 dihedral
orientations, so flipped / 90-degree-rotated copies - the augmentations
PlantVillage and JMuBEN ship pre-applied - still match. Crops and zooms are
NOT caught; that limit is reported, not hidden.

Size and threshold are calibrated on the real data (tests/calibrate_hash.py):

                  same photo, flipped    different leaves
    64-bit dHash      max 5                  min 7      <- 2-bit gap: 24k false matches
   256-bit dHash      max 21                 min 51     <- used; threshold 24

The all-pairs search is exact and vectorised (numpy popcount), not approximate.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
from PIL import Image

HASH_SIDE = 16
HASH_BITS = HASH_SIDE * HASH_SIDE        # 256
WORDS = HASH_BITS // 64                  # 4 x uint64
DEFAULT_MAX_DISTANCE = 24


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _dhash_bits(gray: np.ndarray) -> int:
    diff = (gray[:, 1:] > gray[:, :-1]).flatten()
    return int("".join("1" if b else "0" for b in diff), 2)


def dihedral_dhashes(img: Image.Image) -> list[int]:
    """256-bit dHash of the 8 rotations/flips. Index 0 is the image as stored."""
    arr = np.asarray(img.convert("L").resize((128, 128), Image.Resampling.BILINEAR), dtype=np.float32)
    out = []
    for k in range(4):
        r = np.rot90(arr, k)
        for v in (r, np.fliplr(r)):
            small = Image.fromarray(np.ascontiguousarray(v)).resize((HASH_SIDE + 1, HASH_SIDE),
                                                                      Image.Resampling.BILINEAR)
            out.append(_dhash_bits(np.asarray(small, dtype=np.float32)))
    return out


def image_hashes(path: Path) -> list[int]:
    with Image.open(path) as im:
        im.draft("RGB", (256, 256))  # fast JPEG decode at reduced size
        return dihedral_dhashes(im)


def hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def _pack(values: list[int]) -> np.ndarray:
    """Python ints (HASH_BITS wide) -> (n, WORDS) uint64."""
    out = np.zeros((len(values), WORDS), dtype=np.uint64)
    mask = (1 << 64) - 1
    for i, v in enumerate(values):
        for w in range(WORDS):
            out[i, w] = (v >> (64 * w)) & mask
    return out


def near_duplicate_pairs(canonical: list[int], variants: list[list[int]], max_distance: int,
                         chunk: int = 8) -> set[tuple[int, int]]:
    # Peak memory per chunk ~ chunk x 8 x n x 4 x 8 bytes (~87 MB at n=42.5k, chunk=8).
    """Pairs (i, j), i < j, where some orientation of j is within max_distance of i. Exact."""
    n = len(canonical)
    if n < 2:
        return set()
    C = _pack(canonical)                                               # (n, W)
    V = _pack([h for vs in variants for h in vs]).reshape(n, 8, WORDS)  # (n, 8, W)
    pairs: set[tuple[int, int]] = set()
    for start in range(0, n, chunk):
        block = V[start:start + chunk]                                  # (b, 8, W)
        x = np.bitwise_xor(block[:, :, None, :], C[None, None, :, :])   # (b, 8, n, W)
        d = np.bitwise_count(x).sum(axis=3, dtype=np.int32).min(axis=1)  # (b, n)
        js, is_ = np.nonzero(d <= max_distance)
        for jj, i in zip(js.tolist(), is_.tolist()):
            j = start + jj
            if i != j:
                pairs.add((min(i, j), max(i, j)))
    return pairs


class UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[max(ra, rb)] = min(ra, rb)
