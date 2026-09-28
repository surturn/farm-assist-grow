"""Source registry: every folder that may feed the v1 dataset, and how.

Rules enforced here and re-checked by verify_split.py:
- Maize and cassava have no entries. There is no "skip" flag to forget:
  anything not registered is never read.
- A mapping whose label is not provable from the source is not registered.
  Excluded on purpose, with the reason kept here:
    * CCMT Tomato "leaf blight"  - source does not say early or late blight;
      the old merge guessed Late_Blight.
    * CCMT Tomato "verticulium wilt" - not in scope, and its files are named
      "leaf blight912_.jpg" etc., i.e. likely mislabelled copies.
    * CCMT Tomato "leaf curl" - leaf curl has several causes; not provably TYLCV.
    * PlantDoc1 - maize only. Dropped completely.
    * CCMT "Dataset-Augmented" - augmented before any split; Raw Data is used.

role:
  "pool"  - may be split into train/val/test.
  "field" - field-photo evaluation only. Never trained on.
  "ood"   - out-of-scope probe (avocado, mango cercospora). Never trained on;
            measures how often abstention catches untrained cases.
grouping:
  "plantvillage_uuid" - group = UUID prefix before '___' (augmented siblings share it)
  "file"              - group = file stem; near-duplicate union merges further
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

AIMODEL_DIR = Path(__file__).resolve().parents[1]


def data_root() -> Path:
    return Path(os.environ.get("FARM_DATA_ROOT", AIMODEL_DIR))


@dataclass(frozen=True)
class Source:
    source_id: str          # stable id, recorded in the split manifest
    rel_path: str           # relative to data_root()
    label: str              # manifest class label (or OOD tag for role=ood)
    role: str               # pool | field | ood
    grouping: str           # plantvillage_uuid | file
    origin: str             # dataset name, for provenance
    kind: str               # lab | field
    acquire: str = ""       # where to download it if missing

    def path(self) -> Path:
        return data_root() / self.rel_path


PV = "PlantDoc2/New Plant Diseases Dataset(Augmented)"
CCMT_RAW = "Dataset for Crop Pest and Disease Detection/Raw Data/CCMT Dataset"

_PV_MAP = {
    "Tomato___Bacterial_spot": "Tomato___Bacterial_Spot",
    "Tomato___Early_blight": "Tomato___Early_Blight",
    "Tomato___Late_blight": "Tomato___Late_Blight",
    "Tomato___Leaf_Mold": "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot": "Tomato___Septoria_Leaf_Spot",
    "Tomato___Target_Spot": "Tomato___Target_Spot",
    "Tomato___Tomato_mosaic_virus": "Tomato___Mosaic_Virus",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "Tomato___Yellow_Leaf_Curl_Virus",
    "Tomato___healthy": "Tomato___Healthy",
    "Pepper,_bell___Bacterial_spot": "Pepper___Bacterial_Spot",
    "Pepper,_bell___healthy": "Pepper___Healthy",
    "Potato___Early_blight": "Potato___Early_Blight",
    "Potato___Late_blight": "Potato___Late_Blight",
    "Potato___healthy": "Potato___Healthy",
}

_CCMT_RAW_MAP = {
    "Cashew/anthracnose": "Cashew___Anthracnose",
    "Cashew/gumosis": "Cashew___Gummosis",
    "Cashew/healthy": "Cashew___Healthy",
    "Cashew/leaf miner": "Cashew___Leaf_Miner",
    "Cashew/red rust": "Cashew___Red_Rust",
    "Tomato/septoria leaf spot": "Tomato___Septoria_Leaf_Spot",
    "Tomato/healthy": "Tomato___Healthy",
}


def _build() -> list[Source]:
    out: list[Source] = []
    for split in ("train", "valid"):
        for folder, label in _PV_MAP.items():
            out.append(Source(f"plantvillage/{split}/{folder}", f"{PV}/{split}/{folder}", label,
                              "pool", "plantvillage_uuid", "PlantVillage (augmented)", "lab"))
    for folder, label in _CCMT_RAW_MAP.items():
        out.append(Source(f"ccmt_raw/{folder}", f"{CCMT_RAW}/{folder}", label,
                          "pool", "file", "CCMT raw (Ghana)", "field"))

    # ── Not yet downloaded. Paths are where download_sources.md says to unpack them.
    coffee = "https://data.mendeley.com/datasets/t2r6rszp5c/1 and https://data.mendeley.com/datasets/tgv3zb82nd/1"
    for folder, label in {
        "Cerscospora": "Coffee___Cercospora_Leaf_Spot",
        "Rust": "Coffee___Rust",
        "Phoma": "Coffee___Phoma",
        "Miner": "Coffee___Leaf_Miner",
        "Healthy": "Coffee___Healthy",
    }.items():
        out.append(Source(f"jmuben/{folder}", f"external/JMuBEN/{folder}", label,
                          "pool", "file", "JMuBEN/JMuBEN2 (Kirinyaga, Kenya)", "field", coffee))

    ibean = "https://github.com/AI-Lab-Makerere/ibean (MIT)"
    for folder, label in {"angular_leaf_spot": "Bean___Angular_Leaf_Spot", "bean_rust": "Bean___Rust",
                          "healthy": "Bean___Healthy"}.items():
        out.append(Source(f"ibean/{folder}", f"external/iBean/{folder}", label,
                          "pool", "file", "iBean (Uganda)", "field", ibean))
    tzbean = "https://www.sciencedirect.com/science/article/pii/S2352340924004773 (Zenodo)"
    for folder, label in {"anthracnose": "Bean___Anthracnose", "rust": "Bean___Rust",
                          "healthy": "Bean___Healthy"}.items():
        out.append(Source(f"tzbean/{folder}", f"external/TanzaniaBean/{folder}", label,
                          "pool", "file", "Common bean (Tanzania)", "field", tzbean))

    chili = "https://data.mendeley.com/datasets/wzc6r6w5w5/2 (+ mosaic source to confirm)"
    for folder, label in {"anthracnose": "Pepper___Anthracnose", "mosaic": "Pepper___Mosaic_Virus",
                          "healthy": "Pepper___Healthy"}.items():
        out.append(Source(f"chili/{folder}", f"external/Chili/{folder}", label,
                          "pool", "file", "Chili leaf (Bangladesh)", "field", chili))

    # LICENCE BLOCKER: MangoLeafBD is CC BY-NC 3.0 (non-commercial). fetch_datasets.py
    # refuses it without --allow-noncommercial. Mango classes stay empty (G8 fails)
    # until a commercial-use source or a licence decision exists.
    mango = "https://data.mendeley.com/datasets/hxsnvwty3r/1 (CC BY-NC 3.0 - non-commercial)"
    for folder, label in {"Anthracnose": "Mango___Anthracnose", "Powdery Mildew": "Mango___Powdery_Mildew",
                          "Healthy": "Mango___Healthy"}.items():
        out.append(Source(f"mangoleafbd/{folder}", f"external/MangoLeafBD/{folder}", label,
                          "pool", "file", "MangoLeafBD (Bangladesh)", "field", mango))

    # ── Field evaluation only.
    bracol = "https://data.mendeley.com/datasets/yy2k5y8mxg/1"
    for folder, label in {"rust": "Coffee___Rust", "cercospora": "Coffee___Cercospora_Leaf_Spot",
                          "miner": "Coffee___Leaf_Miner", "phoma": "Coffee___Phoma",
                          "healthy": "Coffee___Healthy"}.items():
        out.append(Source(f"bracol/{folder}", f"external/BRACOL/{folder}", label,
                          "field", "file", "BRACOL (Brazil)", "field", bracol))
    rocole = "https://data.mendeley.com/datasets/c5yvn32dzg/2"
    for folder, label in {"rust": "Coffee___Rust", "healthy": "Coffee___Healthy"}.items():
        out.append(Source(f"rocole/{folder}", f"external/RoCoLe/{folder}", label,
                          "field", "file", "RoCoLe (Ecuador, Robusta)", "field", rocole))
    plantdoc = "https://github.com/pratikkayal/PlantDoc-Dataset (CC BY 4.0) - test/ folder"
    for folder, label in {
        "Tomato Early blight leaf": "Tomato___Early_Blight",
        "Tomato Septoria leaf spot": "Tomato___Septoria_Leaf_Spot",
        "Tomato leaf late blight": "Tomato___Late_Blight",
        "Tomato leaf bacterial spot": "Tomato___Bacterial_Spot",
        "Tomato mold leaf": "Tomato___Leaf_Mold",
        "Tomato leaf mosaic virus": "Tomato___Mosaic_Virus",
        "Tomato leaf yellow virus": "Tomato___Yellow_Leaf_Curl_Virus",
        "Tomato leaf": "Tomato___Healthy",
        "Bell_pepper leaf spot": "Pepper___Bacterial_Spot",
        "Bell_pepper leaf": "Pepper___Healthy",
        "Potato leaf early blight": "Potato___Early_Blight",
        "Potato leaf late blight": "Potato___Late_Blight",
    }.items():
        out.append(Source(f"plantdoc_field/{folder}", f"external/PlantDoc/test/{folder}", label,
                          "field", "file", "PlantDoc field (web-sourced)", "field", plantdoc))

    # ── OOD probes: must be answered "not sure".
    out.append(Source("ood/avocado", "external/OOD/avocado", "OOD___Avocado", "ood", "file",
                      "Avocado leaves (to collect in Kenya)", "field", "field collection"))
    out.append(Source("ood/mango_cercospora", "external/OOD/mango_cercospora", "OOD___Mango_Cercospora",
                      "ood", "file", "Mango cercospora (to collect)", "field", "field collection"))
    return out


SOURCES: list[Source] = _build()


def pool_sources() -> list[Source]:
    return [s for s in SOURCES if s.role == "pool"]


def field_sources() -> list[Source]:
    return [s for s in SOURCES if s.role == "field"]


def ood_sources() -> list[Source]:
    return [s for s in SOURCES if s.role == "ood"]
