/**
 * Shared Hessian / Gaussian machinery used by the structure-specific filters
 * (vessel = tube enhancement, nodule = blob enhancement). DOM-free and pure.
 *
 * All routines work on a single CT slice in row-major order (`v[y*width + x]`)
 * and use clamped (edge-replicated) borders.
 */

/** Separable Gaussian kernel, radius = ceil(3σ), normalized to sum 1. */
export function gaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  const twoSigma2 = 2 * sigma * sigma;
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / twoSigma2);
    kernel[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }
  return kernel;
}

/** Two-pass separable convolution with `kernel` (clamped borders). */
export function blurSeparable(
  src: Float32Array,
  width: number,
  height: number,
  kernel: Float32Array
): Float32Array {
  const radius = (kernel.length - 1) / 2;
  const tmp = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let t = -radius; t <= radius; t++) {
        let xx = x + t;
        if (xx < 0) {
          xx = 0;
        } else if (xx >= width) {
          xx = width - 1;
        }
        acc += src[row + xx] * kernel[t + radius];
      }
      tmp[row + x] = acc;
    }
  }

  const out = new Float32Array(width * height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let acc = 0;
      for (let t = -radius; t <= radius; t++) {
        let yy = y + t;
        if (yy < 0) {
          yy = 0;
        } else if (yy >= height) {
          yy = height - 1;
        }
        acc += tmp[yy * width + x] * kernel[t + radius];
      }
      out[y * width + x] = acc;
    }
  }
  return out;
}

export interface HessianEigen {
  /** Smaller-magnitude eigenvalue per pixel. */
  l1: Float32Array;
  /** Larger-magnitude eigenvalue per pixel. */
  l2: Float32Array;
  /** Structureness sqrt(l1² + l2²) per pixel. */
  s: Float32Array;
  /** Maximum structureness within `region` (or the whole slice). */
  maxS: number;
}

/**
 * Scale-normalized (γ=1) Hessian eigen-analysis at a single Gaussian scale.
 * Eigenvalues are ordered by magnitude (|l1| ≤ |l2|). `region` (0/1) restricts
 * the `maxS` search so the adaptive sensitivity is tuned to in-lung structures.
 */
export function hessianEigenAtScale(
  img: Float32Array,
  width: number,
  height: number,
  sigma: number,
  region?: Uint8Array
): HessianEigen {
  const blurred = blurSeparable(img, width, height, gaussianKernel(sigma));
  const norm = sigma * sigma;
  const n = width * height;
  const l1 = new Float32Array(n);
  const l2 = new Float32Array(n);
  const s = new Float32Array(n);
  let maxS = 0;

  for (let y = 0; y < height; y++) {
    const yUp = y > 0 ? y - 1 : 0;
    const yDn = y < height - 1 ? y + 1 : height - 1;
    const row = y * width;
    const rowUp = yUp * width;
    const rowDn = yDn * width;
    for (let x = 0; x < width; x++) {
      const xL = x > 0 ? x - 1 : 0;
      const xR = x < width - 1 ? x + 1 : width - 1;
      const center = blurred[row + x];
      const hxx = (blurred[row + xR] - 2 * center + blurred[row + xL]) * norm;
      const hyy = (blurred[rowDn + x] - 2 * center + blurred[rowUp + x]) * norm;
      const hxy =
        ((blurred[rowDn + xR] - blurred[rowDn + xL] - blurred[rowUp + xR] + blurred[rowUp + xL]) /
          4) *
        norm;

      const halfTrace = (hxx + hyy) / 2;
      const d = (hxx - hyy) / 2;
      const disc = Math.sqrt(d * d + hxy * hxy);
      const ea = halfTrace + disc;
      const eb = halfTrace - disc;

      let e1: number;
      let e2: number;
      if (Math.abs(ea) <= Math.abs(eb)) {
        e1 = ea;
        e2 = eb;
      } else {
        e1 = eb;
        e2 = ea;
      }

      const idx = row + x;
      const struct = Math.sqrt(e1 * e1 + e2 * e2);
      l1[idx] = e1;
      l2[idx] = e2;
      s[idx] = struct;
      if ((!region || region[idx]) && struct > maxS) {
        maxS = struct;
      }
    }
  }

  return { l1, l2, s, maxS };
}

/** Clamp HU into [lo, hi] to bound dynamic range before Hessian filtering. */
export function clampHu(hu: Float32Array, lo: number, hi: number): Float32Array {
  const n = hu.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = hu[i];
    out[i] = v < lo ? lo : v > hi ? hi : v;
  }
  return out;
}
