import { LungStructureId, setLungSegmentationProvider } from './lungSegmentation';
import { LungField, computeLungField, computeStructureMask } from './lungThresholding';
import { BaseLungSegmentationProvider, SliceContext } from './baseLungSegmentationProvider';
import { MedSam2Box, encodeHu, medsam2Health, medsam2Segment } from './medsam2Client';
import { close, connectedComponents, fillHoles, keepComponents, open } from './morphology';

const SEG_ID_PREFIX = 'lungct-medsam2::';

/** CT window [center, width] per structure used to normalize HU for the model. */
const STRUCTURE_WINDOW: Record<LungStructureId, [number, number]> = {
  lungParenchyma: [-500, 1400],
  vessel: [-100, 700],
  nodule: [-100, 700],
  iceBall: [-200, 800],
};

/**
 * Structures suited to a single bounding-box prompt (compact, blob-like). The
 * distributed structures — whole-lung `lungParenchyma` and the branching
 * `vessel` tree — are computed analytically instead, because a single box that
 * spans the whole lung carries no useful localization for MedSAM2.
 */
const MODEL_STRUCTURES: ReadonlySet<LungStructureId> = new Set<LungStructureId>([
  'nodule',
  'iceBall',
]);

/**
 * Auto-refinement ROI sizing. Each threshold candidate is segmented on a
 * zoomed crop whose half-size follows the candidate's bounding box:
 *  - `ROI_PADDING`: extra pixels beyond half the bbox so the prompt box isn't
 *    skin-tight,
 *  - `MIN/MAX_ROI_HALF`: tiny candidates still get a workable crop; huge ones
 *    (ice balls) don't need the zoom anyway.
 */
const ROI_PADDING = 6;
const MIN_ROI_HALF = 12;
const MAX_ROI_HALF = 96;

/** Upper bound on per-slice model calls; excess (smallest) candidates are skipped. */
const MAX_CANDIDATES_PER_SLICE = 8;

/** Max cached slice masks (per provider) to bound memory during long sessions. */
const MAX_CACHE = 256;

function intersect(mask: Uint8Array, region: Uint8Array): Uint8Array {
  const n = Math.min(mask.length, region.length);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < n; i++) {
    out[i] = mask[i] && region[i] ? 1 : 0;
  }
  return out;
}

/**
 * Cosmetic clean-up of a lesion mask: fill interior holes and run a 1px
 * morphological close to smooth jagged single-pixel staircases on the border.
 * An opening removes any thin spurs without eating into the body of the nodule.
 */
function smoothMask(mask: Uint8Array, width: number, height: number): Uint8Array {
  let out = fillHoles(mask, width, height);
  out = close(out, width, height, 1);
  out = open(out, width, height, 1);
  return fillHoles(out, width, height);
}

function keepPromptComponent(
  mask: Uint8Array,
  width: number,
  height: number,
  point: [number, number],
  structureId: LungStructureId,
  maxArea = 2500
): Uint8Array {
  const cc = connectedComponents(mask, width, height);
  if (cc.count === 0) {
    return mask;
  }

  const [cx, cy] = point;
  const centerIdx = Math.round(cy) * width + Math.round(cx);
  const centerLabel = centerIdx >= 0 && centerIdx < cc.labels.length ? cc.labels[centerIdx] : 0;

  let bestLabel = centerLabel;
  let bestScore = centerLabel ? 0 : Infinity;
  for (let label = 1; label <= cc.count; label++) {
    const area = cc.areas[label];
    const [minX, minY, maxX, maxY] = cc.bbox[label];
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const aspect = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));
    const fill = area / Math.max(1, bw * bh);

    if (structureId === 'nodule') {
      if (area < 3 || area > maxArea || aspect > 3.5 || fill < 0.2) {
        continue;
      }
    }

    if (label === centerLabel) {
      bestLabel = label;
      break;
    }

    const boxCx = (minX + maxX) / 2;
    const boxCy = (minY + maxY) / 2;
    const dx = boxCx - cx;
    const dy = boxCy - cy;
    const score = dx * dx + dy * dy;
    if (score < bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }

  if (!bestLabel) {
    return new Uint8Array(width * height);
  }
  return keepComponents(cc, width, height, label => label === bestLabel);
}

/**
 * Segmentation backend powered by the MedSAM2 foundation model.
 *
 * For each toggled structure on the current slice we:
 *   1. derive coarse candidate regions with the same HU/blobness thresholds
 *      used by the threshold backend (MedSAM2 is promptable, not a fixed
 *      4-class classifier, so it needs localization),
 *   2. refine EACH candidate on its own zoomed ROI crop — a whole-slice box
 *      prompt makes SAM resize the 512² slice to its internal resolution, so a
 *      small nodule is segmented at very few effective pixels and gets a
 *      coarse, jagged border; cropping lets the lesion fill the model input,
 *   3. confine refined masks to the lung field to avoid leakage.
 *
 * If the service is unreachable or has no weights loaded, we transparently fall
 * back to the pure threshold mask, so the UI keeps working with zero setup and
 * automatically upgrades once MedSAM2 is running.
 */
class MedSam2LungSegmentationProvider extends BaseLungSegmentationProvider {
  private readonly cache = new Map<string, Uint8Array>();
  private availableUntil = 0;
  private unavailableUntil = 0;
  private probing: Promise<boolean> | null = null;

  constructor() {
    super(SEG_ID_PREFIX);
  }

  async computeMasks(
    slice: SliceContext,
    active: LungStructureId[]
  ): Promise<Map<LungStructureId, Uint8Array>> {
    const { hu, width, height, imageId } = slice;
    const field = computeLungField(hu, width, height);
    const out = new Map<LungStructureId, Uint8Array>();

    // Distributed structures (lung parenchyma, vessel tree) are computed
    // analytically — they don't benefit from a single box prompt.
    const modelActive = active.filter(id => MODEL_STRUCTURES.has(id));
    for (const id of active) {
      if (!MODEL_STRUCTURES.has(id)) {
        out.set(id, computeStructureMask(id, hu, field, width, height));
      }
    }

    const available = modelActive.length > 0 && (await this.ensureAvailable());

    for (const id of modelActive) {
      const cacheKey = `${imageId}::${id}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.touch(cacheKey, cached);
        out.set(id, cached);
        continue;
      }

      const thresholdMask = computeStructureMask(id, hu, field, width, height);

      if (!available) {
        out.set(id, thresholdMask);
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        const refined = await this.refineCandidatesViaCrop(slice, id, thresholdMask, field);
        this.put(cacheKey, refined);
        out.set(id, refined);
      } catch {
        this.markUnavailable();
        out.set(id, thresholdMask);
      }
    }

    return out;
  }

  /**
   * Refine every threshold candidate of one structure on one slice: each
   * connected component gets its own crop-based MedSAM2 call (the same zoom
   * trick as click-to-prompt), and the per-candidate masks are merged. Running
   * the model per candidate at high effective resolution — instead of once on
   * the whole slice with a single box around everything — is what makes
   * small-nodule borders precise.
   *
   * Calls run sequentially on purpose: the server-side predictor is stateful
   * (`set_image` then `predict`), so concurrent requests would race.
   */
  private async refineCandidatesViaCrop(
    slice: SliceContext,
    structureId: LungStructureId,
    thresholdMask: Uint8Array,
    field: LungField
  ): Promise<Uint8Array> {
    const { width, height } = slice;
    const cc = connectedComponents(thresholdMask, width, height);
    const merged = new Uint8Array(width * height);
    if (cc.count === 0) {
      return merged;
    }

    // Centroids come from the member pixels (not the bbox center) so the
    // positive point prompt lands on the candidate even for crescent shapes.
    const sumX = new Float64Array(cc.count + 1);
    const sumY = new Float64Array(cc.count + 1);
    for (let i = 0; i < cc.labels.length; i++) {
      const label = cc.labels[i];
      if (label) {
        sumX[label] += i % width;
        sumY[label] += Math.floor(i / width);
      }
    }

    // Largest first when the per-slice model-call budget caps the count.
    const order: number[] = [];
    for (let label = 1; label <= cc.count; label++) {
      order.push(label);
    }
    order.sort((a, b) => cc.areas[b] - cc.areas[a]);

    for (const label of order.slice(0, MAX_CANDIDATES_PER_SLICE)) {
      const [minX, minY, maxX, maxY] = cc.bbox[label];
      const half = Math.ceil(Math.max(maxX - minX + 1, maxY - minY + 1) / 2) + ROI_PADDING;
      const roiHalf = Math.max(MIN_ROI_HALF, Math.min(MAX_ROI_HALF, half));
      const cx = Math.round(sumX[label] / cc.areas[label]);
      const cy = Math.round(sumY[label] / cc.areas[label]);

      // eslint-disable-next-line no-await-in-loop
      const part = await this.segmentRegionViaCrop(slice, structureId, [cx, cy], roiHalf, field, [
        minX,
        minY,
        maxX,
        maxY,
      ]);
      if (part) {
        for (let i = 0; i < part.length; i++) {
          if (part[i]) {
            merged[i] = 1;
          }
        }
      } else {
        // Crop unworkable (e.g. a thin sliver at the image edge): keep the raw
        // threshold component rather than dropping the candidate entirely.
        for (let i = 0; i < cc.labels.length; i++) {
          if (cc.labels[i] === label) {
            merged[i] = 1;
          }
        }
      }
    }
    return merged;
  }

  /**
   * Click-to-prompt: crop a zoomed-in patch around the clicked lesion and send
   * *that* to MedSAM2, then paste the mask back into full-slice coordinates.
   *
   * Sending the whole 512² slice forces SAM to resize the entire image to its
   * internal resolution, so a small nodule is segmented at very few effective
   * pixels (coarse, jagged border). Cropping the ROI means the lesion fills the
   * model input, giving a much finer, smoother boundary. Falls back to the
   * model-free region grow (base implementation) when the service is down.
   */
  protected async segmentPointMask(
    slice: SliceContext,
    structureId: LungStructureId,
    point: [number, number]
  ): Promise<Uint8Array | null> {
    if (await this.ensureAvailable()) {
      const refined = await this.segmentPointViaCrop(slice, structureId, point);
      if (refined) {
        return refined;
      }
    }
    return super.segmentPointMask(slice, structureId, point);
  }

  /** Click path: the ROI size comes from the user-configurable prompt ROI. */
  private async segmentPointViaCrop(
    slice: SliceContext,
    structureId: LungStructureId,
    point: [number, number]
  ): Promise<Uint8Array | null> {
    const roiHalf = Math.max(MIN_ROI_HALF, Math.round(this.clickPromptRoiSizePx / 2));
    return this.segmentRegionViaCrop(slice, structureId, point, roiHalf);
  }

  /**
   * Crop → zoomed model inference → paste back → confine → smooth.
   * `promptBox` (full-slice coordinates) lets the auto path pass the
   * candidate's real bounding box; without it the box is symmetric around
   * `point` (click path).
   */
  private async segmentRegionViaCrop(
    slice: SliceContext,
    structureId: LungStructureId,
    point: [number, number],
    roiHalf: number,
    knownField?: LungField,
    promptBox?: MedSam2Box
  ): Promise<Uint8Array | null> {
    const { hu, width, height } = slice;
    const [col, row] = point;
    // Crop a bit wider than the ROI so the model has surrounding context.
    const cropHalf = Math.min(Math.round(roiHalf * 1.4), 180);
    const x0 = Math.max(0, col - cropHalf);
    const y0 = Math.max(0, row - cropHalf);
    const x1 = Math.min(width - 1, col + cropHalf);
    const y1 = Math.min(height - 1, row + cropHalf);
    const cw = x1 - x0 + 1;
    const ch = y1 - y0 + 1;
    if (cw < 12 || ch < 12) {
      return null;
    }

    const cropHu = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++) {
      const srcStart = (y + y0) * width + x0;
      cropHu.set(hu.subarray(srcStart, srcStart + cw), y * cw);
    }

    const pcol = col - x0;
    const prow = row - y0;
    const box: MedSam2Box = promptBox
      ? [
          Math.max(0, promptBox[0] - x0 - ROI_PADDING),
          Math.max(0, promptBox[1] - y0 - ROI_PADDING),
          Math.min(cw - 1, promptBox[2] - x0 + ROI_PADDING),
          Math.min(ch - 1, promptBox[3] - y0 + ROI_PADDING),
        ]
      : [
          Math.max(0, pcol - roiHalf),
          Math.max(0, prow - roiHalf),
          Math.min(cw - 1, pcol + roiHalf),
          Math.min(ch - 1, prow + roiHalf),
        ];

    try {
      const cropMask = await medsam2Segment({
        width: cw,
        height: ch,
        huBase64: encodeHu(cropHu),
        structure: structureId,
        points: [[pcol, prow, 1]],
        box,
        window: STRUCTURE_WINDOW[structureId],
      });

      const full = new Uint8Array(width * height);
      for (let y = 0; y < ch; y++) {
        const dstStart = (y + y0) * width + x0;
        const srcStart = y * cw;
        for (let x = 0; x < cw; x++) {
          if (cropMask[srcStart + x]) {
            full[dstStart + x] = 1;
          }
        }
      }

      const field = knownField ?? computeLungField(hu, width, height);
      const confined = intersect(full, field.lungRegion);
      const smoothed = smoothMask(confined, width, height);
      // A full ROI disc is the upper bound on a believable single lesion.
      const maxArea = Math.round(Math.PI * roiHalf * roiHalf) + 64;
      return keepPromptComponent(smoothed, width, height, point, structureId, maxArea);
    } catch {
      this.markUnavailable();
      return null;
    }
  }

  protected onDispose(): void {
    this.cache.clear();
    this.availableUntil = 0;
    this.unavailableUntil = 0;
    this.probing = null;
  }

  /** Health-gate model calls so a down service doesn't get hit on every scroll. */
  private async ensureAvailable(): Promise<boolean> {
    const now = Date.now();
    if (now < this.unavailableUntil) {
      return false;
    }
    if (now < this.availableUntil) {
      return true;
    }
    if (!this.probing) {
      this.probing = medsam2Health()
        .then(health => {
          const ok = health.ok && health.modelLoaded;
          if (ok) {
            this.availableUntil = Date.now() + 30000;
          } else {
            this.unavailableUntil = Date.now() + 15000;
          }
          return ok;
        })
        .catch(() => {
          this.unavailableUntil = Date.now() + 15000;
          return false;
        })
        .finally(() => {
          this.probing = null;
        });
    }
    return this.probing;
  }

  private markUnavailable(): void {
    this.unavailableUntil = Date.now() + 15000;
    this.availableUntil = 0;
  }

  private touch(key: string, value: Uint8Array): void {
    this.cache.delete(key);
    this.cache.set(key, value);
  }

  private put(key: string, value: Uint8Array): void {
    this.cache.set(key, value);
    while (this.cache.size > MAX_CACHE) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.cache.delete(oldest);
    }
  }
}

let instance: MedSam2LungSegmentationProvider | null = null;

/**
 * Register the MedSAM2-backed segmentation provider as active. Falls back to HU
 * thresholds automatically when the MedSAM2 service is unavailable.
 */
export function registerMedSam2LungSegmentation(): MedSam2LungSegmentationProvider {
  if (!instance) {
    instance = new MedSam2LungSegmentationProvider();
  }
  setLungSegmentationProvider(instance);
  return instance;
}

/** Tear down listeners/cache and restore the no-op provider. Call on mode exit. */
export function unregisterMedSam2LungSegmentation(): void {
  instance?.dispose();
  instance = null;
  setLungSegmentationProvider(null);
}

export { MedSam2LungSegmentationProvider };
