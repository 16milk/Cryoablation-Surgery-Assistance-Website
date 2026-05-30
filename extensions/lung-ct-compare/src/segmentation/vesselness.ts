/**
 * 2D multi-scale Hessian "vesselness" (Frangi) filter for lung CT vessel
 * enhancement. DOM-free and pure so it can be unit tested.
 *
 * Why this instead of an HU band: pulmonary vessels are a thin, branching tree
 * whose intensity overlaps soft tissue, fissures and bronchial walls — a flat
 * threshold cannot separate them. The Hessian filter responds to *tube-like*
 * shapes (one small eigenvalue along the vessel, one large negative eigenvalue
 * across it) and naturally suppresses blobs (nodules) and sheets (fissures,
 * chest wall), giving a far cleaner vessel map.
 *
 * Reference: Frangi et al., "Multiscale vessel enhancement filtering" (1998).
 */

import { clampHu, hessianEigenAtScale } from './hessian';

/** Scales (px) probed by the filter — roughly the half-widths of the vessels we
 * want to catch, from peripheral (~1.5px) to mid/hilar (~4px). */
const SCALES = [1.5, 2.5, 4];

/** Frangi blobness sensitivity (β). Lower = stricter about tubular-vs-blob. */
const BETA = 0.5;

/** HU clamp applied before filtering, to stop bone/contrast/chest-wall from
 * dominating the structureness normalization while keeping vessel contrast. */
const CLAMP_LO = -1000;
const CLAMP_HI = 300;

/**
 * Compute a vesselness response in [0, 1] for each pixel, maximized over scales.
 * `region` (0/1, optional) restricts the structureness normalization so the
 * response is tuned to in-lung structures rather than the chest wall.
 */
export function computeVesselness(
  hu: Float32Array,
  width: number,
  height: number,
  region?: Uint8Array
): Float32Array {
  const n = width * height;
  const clamped = clampHu(hu, CLAMP_LO, CLAMP_HI);
  const out = new Float32Array(n);
  const twoBeta2 = 2 * BETA * BETA;

  for (const sigma of SCALES) {
    const { l1, l2, s, maxS } = hessianEigenAtScale(clamped, width, height, sigma, region);
    if (maxS <= 0) {
      continue;
    }
    const c = 0.5 * maxS;
    const twoC2 = 2 * c * c;

    for (let i = 0; i < n; i++) {
      const e2 = l2[i];
      // Bright (vessel) on dark (lung) background => largest-magnitude
      // eigenvalue must be negative; otherwise no response.
      if (e2 >= 0) {
        continue;
      }
      const rb = l1[i] / e2; // blobness in [0, 1]
      const struct = s[i];
      const v = Math.exp(-(rb * rb) / twoBeta2) * (1 - Math.exp(-(struct * struct) / twoC2));
      if (v > out[i]) {
        out[i] = v;
      }
    }
  }

  return out;
}
