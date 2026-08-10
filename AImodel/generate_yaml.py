import os, yaml

dataset_path = r"C:\Users\semutryr\Desktop\Projects\farm-assist-grow\AImodel\KenyaCropDisease"
train_path = os.path.join(dataset_path, "train")

# Read class names from folder names, sorted for consistency
classes = sorted(os.listdir(train_path))

config = {
    "path": dataset_path,
    "train": "train",
    "val": "val",
    "test": "test",
    "nc": len(classes),
    "names": {i: name for i, name in enumerate(classes)}
}

with open("data.yaml", "w") as f:
    yaml.dump(config, f, default_flow_style=False, allow_unicode=True)

print(f"Generated data.yaml with {len(classes)} classes:")
for i, name in enumerate(classes):
    count = len(os.listdir(os.path.join(train_path, name)))
    print(f"  {i:2d}: {name} ({count} images)")