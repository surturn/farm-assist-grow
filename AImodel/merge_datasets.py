import os
import shutil
import random
from pathlib import Path

# ── CONFIG ──────────────────────────────────────────────────────────────────
BASE = Path(r"C:\Users\semutryr\Desktop\Projects\farm-assist-grow\AImodel")
OUTPUT = BASE / "KenyaCropDisease"
SPLIT = (0.80, 0.10, 0.10)  # train / val / test
SEED = 42
random.seed(SEED)

# ── DEFINE SOURCES ───────────────────────────────────────────────────────────
# Format: (source_folder, output_class_name)
SOURCES = [
    # ── PlantDoc2: New Plant Diseases Dataset (Augmented) ──
    # Tomato
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Tomato___Bacterial_spot",       "Tomato___Bacterial_Spot"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Tomato___Bacterial_spot",       "Tomato___Bacterial_Spot"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Tomato___Early_blight",         "Tomato___Early_Blight"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Tomato___Early_blight",         "Tomato___Early_Blight"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Tomato___Late_blight",          "Tomato___Late_Blight"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Tomato___Late_blight",          "Tomato___Late_Blight"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Tomato___Leaf_Mold",            "Tomato___Leaf_Mold"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Tomato___Leaf_Mold",            "Tomato___Leaf_Mold"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Tomato___Septoria_leaf_spot",   "Tomato___Septoria_Leaf_Spot"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Tomato___Septoria_leaf_spot",   "Tomato___Septoria_Leaf_Spot"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Tomato___Target_Spot",          "Tomato___Target_Spot"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Tomato___Target_Spot",          "Tomato___Target_Spot"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Tomato___Tomato_mosaic_virus",  "Tomato___Mosaic_Virus"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Tomato___Tomato_mosaic_virus",  "Tomato___Mosaic_Virus"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Tomato___Tomato_Yellow_Leaf_Curl_Virus", "Tomato___Yellow_Leaf_Curl_Virus"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Tomato___Tomato_Yellow_Leaf_Curl_Virus", "Tomato___Yellow_Leaf_Curl_Virus"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Tomato___healthy",              "Tomato___Healthy"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Tomato___healthy",              "Tomato___Healthy"),

    # Pepper
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Pepper,_bell___Bacterial_spot", "Pepper___Bacterial_Spot"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Pepper,_bell___Bacterial_spot", "Pepper___Bacterial_Spot"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Pepper,_bell___healthy",        "Pepper___Healthy"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Pepper,_bell___healthy",        "Pepper___Healthy"),

    # Corn/Maize from PlantDoc2
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Corn_(maize)___Common_rust_",          "Maize___Common_Rust"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Corn_(maize)___Common_rust_",          "Maize___Common_Rust"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Corn_(maize)___Northern_Leaf_Blight",  "Maize___Northern_Leaf_Blight"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Corn_(maize)___Northern_Leaf_Blight",  "Maize___Northern_Leaf_Blight"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
     "Maize___Gray_Leaf_Spot"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
     "Maize___Gray_Leaf_Spot"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Corn_(maize)___healthy",               "Maize___Healthy"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Corn_(maize)___healthy",               "Maize___Healthy"),

    # Potato
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Potato___Early_blight",  "Potato___Early_Blight"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Potato___Early_blight",  "Potato___Early_Blight"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Potato___Late_blight",   "Potato___Late_Blight"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Potato___Late_blight",   "Potato___Late_Blight"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/train/Potato___healthy",       "Potato___Healthy"),
    (BASE / "PlantDoc2/New Plant Diseases Dataset(Augmented)/valid/Potato___healthy",       "Potato___Healthy"),

    # ── PlantDoc1: Maize specific ──
    (BASE / "PlantDoc1/data/Blight",        "Maize___Northern_Leaf_Blight"),  # merges with above
    (BASE / "PlantDoc1/data/Common_Rust",   "Maize___Common_Rust"),
    (BASE / "PlantDoc1/data/Gray_Leaf_Spot","Maize___Gray_Leaf_Spot"),
    (BASE / "PlantDoc1/data/Healthy",       "Maize___Healthy"),

    # ── CCMT: Maize ──
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Maize/train_set/fall armyworm",  "Maize___Fall_Armyworm"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Maize/test_set/fall armyworm",   "Maize___Fall_Armyworm"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Maize/train_set/leaf blight",    "Maize___Northern_Leaf_Blight"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Maize/test_set/leaf blight",     "Maize___Northern_Leaf_Blight"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Maize/train_set/leaf spot",      "Maize___Gray_Leaf_Spot"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Maize/test_set/leaf spot",       "Maize___Gray_Leaf_Spot"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Maize/train_set/streak virus",   "Maize___Streak_Virus"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Maize/test_set/streak virus",    "Maize___Streak_Virus"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Maize/train_set/healthy",        "Maize___Healthy"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Maize/test_set/healthy",         "Maize___Healthy"),

    # ── CCMT: Cassava ──
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cassava/train_set/bacterial blight",  "Cassava___Bacterial_Blight"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cassava/test_set/bacterial blight",   "Cassava___Bacterial_Blight"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cassava/train_set/brown spot",        "Cassava___Brown_Spot"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cassava/test_set/brown spot",         "Cassava___Brown_Spot"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cassava/train_set/green mite",        "Cassava___Green_Mite"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cassava/test_set/green mite",         "Cassava___Green_Mite"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cassava/train_set/mosaic",            "Cassava___Mosaic"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cassava/test_set/mosaic",             "Cassava___Mosaic"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cassava/train_set/healthy",           "Cassava___Healthy"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cassava/test_set/healthy",            "Cassava___Healthy"),

    # ── CCMT: Tomato (field images — different from PlantDoc2 lab images) ──
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Tomato/train_set/leaf blight",       "Tomato___Late_Blight"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Tomato/test_set/leaf blight",        "Tomato___Late_Blight"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Tomato/train_set/leaf curl",         "Tomato___Yellow_Leaf_Curl_Virus"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Tomato/test_set/leaf curl",          "Tomato___Yellow_Leaf_Curl_Virus"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Tomato/train_set/septoria leaf spot",
     "Tomato___Septoria_Leaf_Spot"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Tomato/test_set/septoria leaf spot",
     "Tomato___Septoria_Leaf_Spot"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Tomato/train_set/healthy",           "Tomato___Healthy"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Tomato/test_set/healthy",            "Tomato___Healthy"),

    # ── CCMT: Cashew ──
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cashew/train_set/anthracnose3102", "Cashew___Anthracnose"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cashew/test_set/anthracnose",     "Cashew___Anthracnose"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cashew/train_set/gumosis1714",    "Cashew___Gummosis"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cashew/test_set/gumosis",         "Cashew___Gummosis"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cashew/train_set/leaf miner3466", "Cashew___Leaf_Miner"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cashew/test_set/leaf miner",      "Cashew___Leaf_Miner"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cashew/train_set/red rust4751",   "Cashew___Red_Rust"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cashew/test_set/red rust",        "Cashew___Red_Rust"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cashew/train_set/healthy5877",    "Cashew___Healthy"),
    (BASE / "Dataset for Crop Pest and Disease Detection/CCMT Dataset-Augmented/Cashew/test_set/healthy",         "Cashew___Healthy"),
]

# ── MERGE & SPLIT ────────────────────────────────────────────────────────────
def get_images(folder):
    exts = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}
    if not folder.exists():
        print(f"  ⚠ SKIPPED (not found): {folder}")
        return []
    imgs = [f for f in folder.iterdir() if f.suffix in exts]
    return imgs

# Collect all images per output class
class_images = {}
for src, cls_name in SOURCES:
    imgs = get_images(src)
    if imgs:
        class_images.setdefault(cls_name, []).extend(imgs)

# Create output structure and copy images
splits = ["train", "val", "test"]
for cls_name, images in class_images.items():
    random.shuffle(images)
    n = len(images)
    n_train = int(n * SPLIT[0])
    n_val   = int(n * SPLIT[1])

    buckets = {
        "train": images[:n_train],
        "val":   images[n_train:n_train + n_val],
        "test":  images[n_train + n_val:]
    }

    for split, files in buckets.items():
        dest_dir = OUTPUT / split / cls_name
        dest_dir.mkdir(parents=True, exist_ok=True)
        for i, f in enumerate(files):
            # Rename to avoid collisions from multiple sources
            dest = dest_dir / f"{cls_name}_{split}_{i:05d}{f.suffix.lower()}"
            shutil.copy2(f, dest)

# ── SUMMARY ─────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("KENYA CROP DISEASE DATASET — MERGE SUMMARY")
print("="*60)
total = 0
for cls_name in sorted(class_images.keys()):
    n = len(class_images[cls_name])
    total += n
    print(f"  {cls_name:<45} {n:>6} images")
print("-"*60)
print(f"  {'TOTAL':<45} {total:>6} images")
print(f"\nOutput saved to: {OUTPUT}")
print("\nSplit breakdown:")
for split in splits:
    split_dir = OUTPUT / split
    if split_dir.exists():
        count = sum(len(list((split_dir/c).iterdir())) for c in split_dir.iterdir() if c.is_dir())
        print(f"  {split:<8} {count} images")