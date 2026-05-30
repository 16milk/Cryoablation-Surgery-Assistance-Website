import type { LungStructureId } from './lungSegmentation';

/**
 * Pure (DOM-free) HU thresholding used by the threshold segmentation provider.
 * Kept separate from cornerstone wiring so the classification logic can be unit
 * tested and reasoned about on its own.
 *
 * All inputs are a single CT slice's Hounsfield-unit values in row-major order
 * (`hu[y * width + x]`). Outputs are 0/1 masks of the same length.
 */

/** Labelmap segment index for each structure (1-based; 0 is reserved for "no label"). */
export const SEGMENT_INDEX: Record<LungStructureId, number> = {
  lungParenchyma: 1,
  vessel: 2,
  nodule: 3,
  iceBall: 4,
};

/**
 * HU windows per structure. Ranges are intentionally disjoint and contiguous so
 * every voxel maps to at most one structure (no overlap ambiguity in the shared
 * labelmap). Values are approximate clinical bands — exact for aerated lung,
 * reasonable for vessels, and deliberately coarse for nodule / ice ball (which
 * cannot be separated by intensity alone). `[lower, upper)` half-open.
 */
export const HU_RANGES: Record<Exclude<LungStructureId, 'lungParenchyma'>, [number, number]> = {
  iceBall: [-400, -120],
  nodule: [-120, 60],
  vessel: [60, 600],
};

/** Below this HU a voxel is considered air (lung air space or outside the body). */
const AIR_HU = -400;

/**
 * Dilation radius (px) applied to the interior-air mask to obtain the lung
 * "field". This grows the aerated region outward so embedded soft-tissue
 * structures (vessels, nodules) sitting just inside the lung are captured while
 * still excluding the chest wall and mediastinum.
 */
const LUNG_DILATION_PX = 8;

export interface LungField {
  /** 1 where the voxel is air enclosed by the body (i.e. the lung air space). */
  interiorAir: Uint8Array;
  /** 1 within the dilated lung field (lung air + adjacent embedded structures). */
  lungRegion: Uint8Array;
}

/**
 * Separable binary dilation (max filter) with a square structuring element of
 * radius `r`. Early-exits per output pixel, so it is fast on sparse masks.
 */
function dilate(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  const n = width * height;
  const horizontal = new Uint8Array(n);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const x0 = x - r < 0 ? 0 : x - r;
      const x1 = x + r >= width ? width - 1 : x + r;
      let on = 0;
      for (let xx = x0; xx <= x1; xx++) {
        if (mask[row + xx]) {
          on = 1;
          break;
        }
      }
      horizontal[row + x] = on;
    }
  }

  const out = new Uint8Array(n);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const y0 = y - r < 0 ? 0 : y - r;
      const y1 = y + r >= height ? height - 1 : y + r;
      let on = 0;
      for (let yy = y0; yy <= y1; yy++) {
        if (horizontal[yy * width + x]) {
          on = 1;
          break;
        }
      }
      out[y * width + x] = on;
    }
  }
  return out;
}

/**
 * Estimate the lung field of a single slice.
 *
 * 1. Threshold air (HU < AIR_HU) — this includes both the lungs and the air
 *    surrounding the patient.
 * 2. Flood-fill air connected to the image border to mark "exterior" air.
 * 3. Interior air = air that is NOT exterior → the lung air space.
 * 4. Dilate the interior air to form the lung region used to constrain the
 *    soft-tissue structures (so chest-wall tissue is not mislabeled).
 */
export function computeLungField(
  hu: Float32Array,
  width: number,
  height: number
): LungField {
  const n = width * height;
  const air = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    air[i] = hu[i] < AIR_HU ? 1 : 0;
  }

  const exterior = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;

  const seed = (idx: number) => {
    if (air[idx] && !exterior[idx]) {
      exterior[idx] = 1;
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

  const interiorAir = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    interiorAir[i] = air[i] && !exterior[i] ? 1 : 0;
  }

  const lungRegion = dilate(interiorAir, width, height, LUNG_DILATION_PX);
  return { interiorAir, lungRegion };
}

/**
 * Compute the 0/1 mask for a single structure on one slice.
 *
 * - `lungParenchyma` is exactly the interior air space.
 * - all other structures are their HU band intersected with the lung region,
 *   which keeps soft-tissue/low-attenuation matches confined to the lungs.
 */
export function computeStructureMask(
  structureId: LungStructureId,
  hu: Float32Array,
  field: LungField,
  width: number,
  height: number
): Uint8Array {
  if (structureId === 'lungParenchyma') {
    return field.interiorAir;
  }

  const n = width * height;
  const out = new Uint8Array(n);
  const [lower, upper] = HU_RANGES[structureId];
  const region = field.lungRegion;
  for (let i = 0; i < n; i++) {
    if (region[i] && hu[i] >= lower && hu[i] < upper) {
      out[i] = 1;
    }
  }
  return out;
}
