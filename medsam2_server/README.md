# MedSAM2 Lung Segmentation Service

A small FastAPI service that runs the [MedSAM2](https://github.com/bowang-lab/MedSAM)
foundation model and returns a segmentation mask for a single CT slice given a
bounding-box prompt. It also hosts the cryo lung VoxelMorph registration model
(`cryo_lung_vxm_epoch_200.pth`) and returns a dense deformation field for the
`lung-ct-compare` viewer mode.

The browser talks to this service through the dev proxy at `/medsam2`
(`/medsam2/health`, `/medsam2/segment`), which forwards to `http://localhost:5200`.

## How it fits in

- The frontend seeds an automatic **bounding-box prompt** for each structure using
  the same HU thresholds as the built-in threshold backend, sends the slice +
  box here, and writes the returned mask into the cornerstone labelmap.
- If this service is **not running** or has **no weights loaded**, the frontend
  transparently falls back to its in-browser HU-threshold segmentation. So the
  feature works with zero setup and automatically upgrades once MedSAM2 is up.
- For registration, the frontend downsamples the baseline and compare CT stacks
  to the VXM `160³` grid, posts them to `/registration/field`, then caches the
  returned LPS millimetre flow. Until the field is ready (or if PyTorch/weights
  are unavailable), slice sync falls back to identity alignment.

## Setup

```bash
cd medsam2_server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Install PyTorch (choose the build matching your CUDA / Apple MPS / CPU).
# Required for VXM registration and MedSAM2 inference:
pip install torch torchvision

# Install SAM2 (MedSAM2 builds on it):
pip install "git+https://github.com/facebookresearch/sam2.git"
```

Download a MedSAM2 checkpoint (see the MedSAM2 repo for links) and point the
service at it:

```bash
export MEDSAM2_CHECKPOINT=/abs/path/to/MedSAM2_latest.pt
export MEDSAM2_CONFIG=configs/sam2.1/sam2.1_hiera_t.yaml   # match your checkpoint
export MEDSAM2_DEVICE=mps        # optional: cuda | mps | cpu (auto-detected otherwise)

# VoxelMorph lung registration checkpoint. Defaults to this Desktop path.
export VXM_CHECKPOINT=/Users/ykxcai/Desktop/cryo_lung_vxm_epoch_200.pth
export VXM_DEVICE=mps            # optional: cuda | mps | cpu (auto-detected otherwise)
```

## Run

```bash
# from medsam2_server/ with the venv active
python app.py                    # serves on http://localhost:5200
# or: uvicorn app:app --host 127.0.0.1 --port 5200
```

Check it:

```bash
curl http://localhost:5200/health
# {"status":"ok","modelLoaded":false,"device":"mps","vxmLoaded":false,"vxmDevice":"mps"}
# Models load lazily on first /segment or /registration/field request.
```

## API

`POST /segment`

```jsonc
{
  "width": 512,
  "height": 512,
  "huBase64": "<base64 little-endian int16 HU, row-major>",
  "structure": "vessel",
  "box": [x0, y0, x1, y1],      // pixel bounding-box prompt
  "window": [center, width]      // CT window used to normalize HU
}
```

Response:

```jsonc
{ "width": 512, "height": 512, "maskBase64": "<base64 uint8 0/1>", "device": "mps", "model": "medsam2" }
```

Errors return `503` (model unavailable — missing weights/deps) or `500`, both of
which trigger the frontend's threshold fallback.

`POST /registration/field`

```jsonc
{
  "baseline": {
    "dimensions": [160, 160, 160],
    "spacing": [xMm, yMm, zMm],
    "origin": [x, y, z],
    "direction": [rowX, rowY, rowZ, colX, colY, colZ, normalX, normalY, normalZ],
    "huBase64": "<base64 little-endian int16 HU, z-major>"
  },
  "compare": { "...": "same shape as baseline" }
}
```

Response:

```jsonc
{
  "dimensions": [160, 160, 160],
  "spacing": [xMm, yMm, zMm],
  "origin": [x, y, z],
  "direction": [row, "...", "normal"],
  "flowBase64": "<base64 float32 LPS displacement, z-major, 3 values per voxel>",
  "device": "mps",
  "model": "cryo_lung_vxm_epoch_200"
}
```

Tuning knobs:

- `VXM_FLOW_CHANNEL_ORDER=zyx` interprets model output channels as depth/row/col
  voxel offsets. Change to `xyz`, `xzy`, etc. if a checkpoint uses another order.
- `VXM_FLOW_SCALE=1.0` multiplies predicted offsets after conversion to mm.
- `VXM_WINDOW_CENTER=-500` and `VXM_WINDOW_WIDTH=1400` control HU normalization.
