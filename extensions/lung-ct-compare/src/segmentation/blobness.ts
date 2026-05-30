/**
 * 2D multi-scale Hessian "blobness" filter for pulmonary nodule enhancement.
 * DOM-free and pure.
 *
 * A nodule is a compact, roughly isotropic bright blob — the opposite of a
 * vessel. The Hessian of a bright blob has BOTH eigenvalues large and negative
 * and of similar magnitude (|l1| ≈ |l2|), whereas a tube has one near-zero
 * eigenvalue (|l1| ≪ |l2|). So this filter rewards isotropy and structureness,
 * which enhances nodules while suppressing the vessel tree and fissures.
 *
 * Reference: Li, Sone, Doi, "Selective enhancement filters for nodules,
 * vessels, and airway walls" (Med. Phys. 2003).
 */

import { clampHu, hessianEigenAtScale } from './hessian';

/** Scales (px) — nodules of interest span a few px to ~1.5cm cross-sections. */
const SCALES = [2, 3.5, 5];

/** Isotropy sensitivity: how strongly to penalize anisotropic (tube) shapes. */
const BETA = 0.5;

const CLAMP_LO = -1000;
const CLAMP_HI = 300;

/**
 * Compute a blobness response in [0, 1] per pixel, maximized over scales.
 * `region` (0/1, optional) restricts the structureness normalization.
 */
export function computeBlobness(
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
      const e1 = l1[i];
      const e2 = l2[i];
      // Bright blob => both eigenvalues negative.
      if (e1 >= 0 || e2 >= 0) {
        continue;
      }
      // ratio in [0, 1]; 1 = isotropic (blob), 0 = tube.
      const ratio = Math.abs(e1) / Math.abs(e2);
      const isotropy = Math.exp(-((1 - ratio) * (1 - ratio)) / twoBeta2);
      const struct = s[i];
      const v = isotropy * (1 - Math.exp(-(struct * struct) / twoC2));
      if (v > out[i]) {
        out[i] = v;
      }
    }
  }

  return out;
}
