/**
 * Small, dependency-free binary morphology + connected-component toolkit used to
 * clean up the nodule / ice-ball candidate masks (remove specks, consolidate
 * blobs, fill holes, and filter components by size/shape). All masks are 0/1
 * Uint8Array in row-major order. Borders are edge-clamped.
 */

/** Separable binary dilation (max) with a square structuring element radius r. */
export function dilate(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  return separable(mask, width, height, r, true);
}

/** Separable binary erosion (min) with a square structuring element radius r. */
export function erode(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  return separable(mask, width, height, r, false);
}

/** Morphological closing: dilate then erode (fills small gaps, smooths). */
export function close(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  return erode(dilate(mask, width, height, r), width, height, r);
}

/** Morphological opening: erode then dilate (removes small specks). */
export function open(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  return dilate(erode(mask, width, height, r), width, height, r);
}

function separable(
  mask: Uint8Array,
  width: number,
  height: number,
  r: number,
  isDilate: boolean
): Uint8Array {
  if (r <= 0) {
    return mask.slice();
  }
  const n = width * height;
  const horizontal = new Uint8Array(n);
  // Pass criterion: dilation = "any neighbor on"; erosion = "all neighbors on".
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const x0 = x - r < 0 ? 0 : x - r;
      const x1 = x + r >= width ? width - 1 : x + r;
      let result = isDilate ? 0 : 1;
      for (let xx = x0; xx <= x1; xx++) {
        const on = mask[row + xx];
        if (isDilate ? on : !on) {
          result = isDilate ? 1 : 0;
          break;
        }
      }
      horizontal[row + x] = result;
    }
  }

  const out = new Uint8Array(n);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const y0 = y - r < 0 ? 0 : y - r;
      const y1 = y + r >= height ? height - 1 : y + r;
      let result = isDilate ? 0 : 1;
      for (let yy = y0; yy <= y1; yy++) {
        const on = horizontal[yy * width + x];
        if (isDilate ? on : !on) {
          result = isDilate ? 1 : 0;
          break;
        }
      }
      out[y * width + x] = result;
    }
  }
  return out;
}

/** Fill background holes fully enclosed by foreground (4-connected background). */
export function fillHoles(mask: Uint8Array, width: number, height: number): Uint8Array {
  const n = width * height;
  const reachable = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;

  const seed = (idx: number) => {
    if (!mask[idx] && !reachable[idx]) {
      reachable[idx] = 1;
      stack[sp++] = idx;
    }
  };

  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + (width - 1));
  }

  while (sp > 0) {
    const idx = stack[--sp];
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) {
      seed(idx - 1);
    }
    if (x < width - 1) {
      seed(idx + 1);
    }
    if (y > 0) {
      seed(idx - width);
    }
    if (y < height - 1) {
      seed(idx + width);
    }
  }

  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    // Foreground stays; background only stays if reachable from the border.
    out[i] = mask[i] || !reachable[i] ? 1 : 0;
  }
  return out;
}

/**
 * Flood-fill from `seedIndex`, accepting connected pixels whose HU is within
 * ±`tolerance` of the seed (and inside `region` if given). 4-connected, capped
 * at `maxArea` pixels. Used as the offline fallback for click-to-prompt when the
 * MedSAM2 service is unavailable.
 */
export function regionGrow(
  hu: Float32Array,
  width: number,
  height: number,
  seedIndex: number,
  tolerance: number,
  region?: Uint8Array,
  maxArea = 20000
): Uint8Array {
  const n = width * height;
  const out = new Uint8Array(n);
  if (seedIndex < 0 || seedIndex >= n) {
    return out;
  }
  if (region && !region[seedIndex]) {
    return out;
  }
  const seedVal = hu[seedIndex];
  const lo = seedVal - tolerance;
  const hi = seedVal + tolerance;
  const stack = new Int32Array(n);
  let sp = 0;

  const visit = (idx: number) => {
    if (!out[idx] && (!region || region[idx]) && hu[idx] >= lo && hu[idx] <= hi) {
      out[idx] = 1;
      stack[sp++] = idx;
    }
  };

  visit(seedIndex);
  let area = 0;
  while (sp > 0) {
    const idx = stack[--sp];
    area += 1;
    if (area > maxArea) {
      break;
    }
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) {
      visit(idx - 1);
    }
    if (x < width - 1) {
      visit(idx + 1);
    }
    if (y > 0) {
      visit(idx - width);
    }
    if (y < height - 1) {
      visit(idx + width);
    }
  }
  return out;
}

export interface ConnectedComponents {
  /** Per-pixel label (0 = background, 1..count = component id). */
  labels: Int32Array;
  count: number;
  /** Pixel area per label; index by label id (areas[0] unused). */
  areas: number[];
  /** Bounding box per label as [minX, minY, maxX, maxY]; index by label id. */
  bbox: Array<[number, number, number, number]>;
}

/** Label 8-connected foreground components with per-label area and bounding box. */
export function connectedComponents(
  mask: Uint8Array,
  width: number,
  height: number
): ConnectedComponents {
  const n = width * height;
  const labels = new Int32Array(n);
  const areas: number[] = [0];
  const bbox: Array<[number, number, number, number]> = [[0, 0, 0, 0]];
  const stack = new Int32Array(n);
  let count = 0;

  for (let start = 0; start < n; start++) {
    if (!mask[start] || labels[start]) {
      continue;
    }
    count += 1;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = count;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % width;
      const y = (idx - x) / width;
      area += 1;
      if (x < minX) {
        minX = x;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (y > maxY) {
        maxY = y;
      }

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) {
          continue;
        }
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) {
            continue;
          }
          const nIdx = ny * width + nx;
          if (mask[nIdx] && !labels[nIdx]) {
            labels[nIdx] = count;
            stack[sp++] = nIdx;
          }
        }
      }
    }

    areas[count] = area;
    bbox[count] = [minX, minY, maxX, maxY];
  }

  return { labels, count, areas, bbox };
}

/**
 * Keep only the components whose label ids satisfy `accept`, returning a new
 * 0/1 mask. `accept` receives the label id and its area/bbox.
 */
export function keepComponents(
  cc: ConnectedComponents,
  width: number,
  height: number,
  accept: (label: number, area: number, bbox: [number, number, number, number]) => boolean
): Uint8Array {
  const keep = new Uint8Array(cc.count + 1);
  for (let label = 1; label <= cc.count; label++) {
    keep[label] = accept(label, cc.areas[label], cc.bbox[label]) ? 1 : 0;
  }
  const out = new Uint8Array(width * height);
  for (let i = 0; i < cc.labels.length; i++) {
    const label = cc.labels[i];
    if (label && keep[label]) {
      out[i] = 1;
    }
  }
  return out;
}
