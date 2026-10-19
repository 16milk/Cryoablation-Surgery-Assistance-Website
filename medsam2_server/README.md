# MedSAM2 Lung Segmentation Service

A small FastAPI service that runs the [MedSAM2](https://github.com/bowang-lab/MedSAM2)
foundation model and returns a segmentation mask for a CT slice or a cropped
3D CT volume given a box/point prompt. It also hosts the cryo lung VoxelMorph registration model
(`cryo_lung_vxm_epoch_200.pth`) and returns a dense deformation field for the
`lung-ct-compare` viewer mode.

The browser talks to this service through the dev proxy at `/medsam2`
(`/medsam2/health`, `/medsam2/segment`, `/medsam2/segment/volume/jobs`), which forwards to `http://localhost:5200`.

## How it fits in

- Automatic refinement seeds a **bounding-box prompt** from threshold candidates.
  A user click or drag-box on a nodule extracts a geometry-aware 3D ROI, sends
  it to the video predictor with a key-frame point/box, and writes returned masks
  back to their source slices.
- The health endpoint reports whether the service is reachable and whether the
  model is uninitialized, ready, or in an error state. A reachable but
  uninitialized model is still callable: the first segmentation request loads
  its weights lazily. Missing weights or a failed request trigger the browser's
  HU-threshold fallback, and its method is shown in the panel.
- For registration, the frontend downsamples the baseline and compare CT stacks
  to the VXM `160³` grid, posts them to `/registration/field`, then caches the
  returned LPS millimetre flow. Until the field is ready (or if PyTorch/weights
  are unavailable), slice sync falls back to identity alignment.

## Setup

```bash
cd medsam2_server
# MedSAM2 requires Python >= 3.10 (upstream package metadata).
python3.10 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Install PyTorch (choose the build matching your CUDA / Apple MPS / CPU).
# Required for VXM registration and MedSAM2 inference:
pip install torch torchvision

# Install the MedSAM2 fork (its NPZ video predictor is required for both
# single-slice prompts and bidirectional 3D volume propagation). Set this to
# a persistent checkout outside medsam2_server so the server working directory
# remains unchanged:
git clone https://github.com/bowang-lab/MedSAM2.git /path/to/MedSAM2
# On CPU/MPS hosts, skip the CUDA extension build; keep the default for CUDA.
export SAM2_BUILD_CUDA=0
pip install -e /path/to/MedSAM2
```

Download a MedSAM2 checkpoint (see the MedSAM2 repo for links) and point the
service at it:

```bash
export MEDSAM2_CHECKPOINT=/abs/path/to/MedSAM2_latest.pt
export MEDSAM2_CONFIG=configs/sam2.1_hiera_t512.yaml   # MedSAM2 Tiny 512 config
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
# modelState is "uninitialized" until the first segmentation request loads weights.
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

`POST /segment/volume` accepts a cropped CT volume, a key-slice frame index,
and a box/point prompt. `dimensions` is `[width, height, depth]`; the HU and
returned mask buffers are little-endian int16 and uint8 respectively in
`[depth, height, width]` order. The response combines forward and reverse
propagation masks with a voxel-wise union.

The browser uses the asynchronous volume job API so a long propagation can
report progress and be cancelled:

- `POST /segment/volume/jobs` returns `202` with a `jobId` and initial status.
- `GET /segment/volume/jobs/{jobId}` returns `queued`, `running`,
  `cancel_requested`, `completed`, `failed`, or `cancelled`, with frame progress.
  Completed responses include `maskBase64`.
- `DELETE /segment/volume/jobs/{jobId}` requests cancellation. Cancellation is
  checked between propagated frames; an active model frame is allowed to finish.

The service runs one stateful predictor job at a time and accepts at most three
pending jobs (one running plus two queued). Terminal job records are retained
for up to 15 minutes, after which they are removed on the next queue operation.

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
